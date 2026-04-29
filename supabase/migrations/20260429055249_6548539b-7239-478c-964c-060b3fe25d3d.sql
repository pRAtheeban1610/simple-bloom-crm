
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.customer_status AS ENUM ('lead', 'prospect', 'active');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'paid', 'unpaid');

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Company',
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_number TEXT,
  logo_url TEXT,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  tax_label TEXT NOT NULL DEFAULT 'Tax',
  default_tax_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  customer_prefix TEXT NOT NULL DEFAULT 'CUST-',
  next_invoice_number INTEGER NOT NULL DEFAULT 1,
  next_customer_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, role)
);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_number TEXT NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  billing_address TEXT,
  tax_number TEXT,
  status public.customer_status NOT NULL DEFAULT 'lead',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, customer_number)
);
CREATE INDEX idx_customers_org ON public.customers(organization_id);
CREATE INDEX idx_customers_status ON public.customers(status);

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, invoice_number)
);
CREATE INDEX idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date);

-- ============ INVOICE ITEMS ============
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER set_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_customers_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER set_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ AUTO ASSIGN CUSTOMER NUMBER ============
CREATE OR REPLACE FUNCTION public.tg_assign_customer_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT;
  v_num INTEGER;
BEGIN
  IF NEW.customer_number IS NULL OR NEW.customer_number = '' THEN
    UPDATE public.organizations
      SET next_customer_number = next_customer_number + 1
      WHERE id = NEW.organization_id
      RETURNING customer_prefix, next_customer_number - 1
      INTO v_prefix, v_num;
    NEW.customer_number := v_prefix || LPAD(v_num::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assign_customer_number BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_assign_customer_number();

-- ============ AUTO ASSIGN INVOICE NUMBER ============
CREATE OR REPLACE FUNCTION public.tg_assign_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT;
  v_num INTEGER;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    UPDATE public.organizations
      SET next_invoice_number = next_invoice_number + 1
      WHERE id = NEW.organization_id
      RETURNING invoice_prefix, next_invoice_number - 1
      INTO v_prefix, v_num;
    NEW.invoice_number := v_prefix || LPAD(v_num::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assign_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_assign_invoice_number();

-- ============ NEW USER => ORG + PROFILE + ADMIN ROLE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org UUID;
BEGIN
  INSERT INTO public.organizations (name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company_name', split_part(NEW.email, '@', 1) || ' Workspace'),
    NEW.email
  )
  RETURNING id INTO v_org;

  INSERT INTO public.profiles (id, organization_id, full_name, email)
  VALUES (NEW.id, v_org, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (NEW.id, v_org, 'admin');

  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ENABLE RLS ============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- organizations
CREATE POLICY "org_select_own" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org(auth.uid()));
CREATE POLICY "org_update_admin" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- profiles
CREATE POLICY "profiles_select_same_org" ON public.profiles FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- user_roles
CREATE POLICY "roles_select_self" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- customers
CREATE POLICY "cust_select" ON public.customers FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "cust_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "cust_update" ON public.customers FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "cust_delete" ON public.customers FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

-- invoices
CREATE POLICY "inv_select" ON public.invoices FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "inv_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "inv_update" ON public.invoices FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));
CREATE POLICY "inv_delete" ON public.invoices FOR DELETE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

-- invoice_items (linked via invoice)
CREATE POLICY "items_select" ON public.invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.organization_id = public.get_user_org(auth.uid())));
CREATE POLICY "items_insert" ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.organization_id = public.get_user_org(auth.uid())));
CREATE POLICY "items_update" ON public.invoice_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.organization_id = public.get_user_org(auth.uid())));
CREATE POLICY "items_delete" ON public.invoice_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.organization_id = public.get_user_org(auth.uid())));
