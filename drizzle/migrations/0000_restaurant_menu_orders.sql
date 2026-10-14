CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_first_admin();

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menu public read" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin insert menu" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update menu" ON public.menu_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete menu" ON public.menu_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 100),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 20),
  order_type text NOT NULL CHECK (order_type IN ('dine_in','delivery')),
  address text CHECK (address IS NULL OR char_length(address) <= 500),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  items jsonb NOT NULL,
  total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','preparing','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.orders TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT USAGE ON SEQUENCE public.orders_order_number_seq TO anon, authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can place order" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');
CREATE POLICY "admin read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.price_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; m record; q int; out_items jsonb := '[]'::jsonb; t numeric := 0;
BEGIN
  IF jsonb_typeof(NEW.items) <> 'array' OR jsonb_array_length(NEW.items) = 0 OR jsonb_array_length(NEW.items) > 100 THEN
    RAISE EXCEPTION 'Order must contain items';
  END IF;
  IF NEW.order_type = 'delivery' AND coalesce(trim(NEW.address),'') = '' THEN
    RAISE EXCEPTION 'Delivery address required';
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    q := (r->>'qty')::int;
    IF q IS NULL OR q < 1 OR q > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, price INTO m FROM public.menu_items WHERE id = (r->>'id')::uuid AND available;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item unavailable'; END IF;
    out_items := out_items || jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'qty', q);
    t := t + m.price * q;
  END LOOP;
  NEW.items := out_items; NEW.total := t; NEW.status := 'new'; NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER orders_price BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.price_order();

ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

INSERT INTO public.menu_items(name,category,price,sort_order) VALUES
('Chicken Alfaham Full','Arabian Grill',420,1),
('Chicken Alfaham Half','Arabian Grill',230,2),
('Chicken Alfaham Quarter','Arabian Grill',130,3),
('Peri Peri Alfaham Full','Arabian Grill',450,4),
('Peri Peri Alfaham Half','Arabian Grill',250,5),
('Chicken Tandoori Full','Arabian Grill',400,6),
('Chicken Tandoori Half','Arabian Grill',220,7),
('Mutton Seekh Kebab','Arabian Grill',280,8),
('Chicken Shish Tawook','Arabian Grill',260,9),
('Lamb Chops Grill','Arabian Grill',480,10),
('Grilled Fish Arabic','Arabian Grill',380,11),
('Chicken Tikka Arabic','Arabian Grill',240,12),
('Chicken Mandi Single','Mandi & Kabsa',280,13),
('Chicken Mandi Family','Mandi & Kabsa',950,14),
('Mutton Mandi Single','Mandi & Kabsa',420,15),
('Mutton Mandi Family','Mandi & Kabsa',1450,16),
('Alfaham Mandi','Mandi & Kabsa',320,17),
('Chicken Kabsa','Mandi & Kabsa',300,18),
('Mutton Kabsa','Mandi & Kabsa',440,19),
('Fish Mandi','Mandi & Kabsa',360,20),
('Juicy Chicken Madfoon','Mandi & Kabsa',330,21),
('Mutton Zurbian','Mandi & Kabsa',460,22),
('Chicken Shawarma Roll','Shawarma',110,23),
('Chicken Shawarma Plate','Shawarma',180,24),
('Mexican Shawarma','Shawarma',130,25),
('Spicy Shawarma Roll','Shawarma',120,26),
('Cheese Shawarma Roll','Shawarma',140,27),
('Mutton Shawarma Roll','Shawarma',160,28),
('Shawarma Combo Box','Shawarma',240,29),
('Kuboos Shawarma','Shawarma',120,30),
('Chicken 65','Chinese Starters',180,31),
('Chilli Chicken Dry','Chinese Starters',200,32),
('Dragon Chicken','Chinese Starters',230,33),
('Chicken Lollipop','Chinese Starters',220,34),
('Pepper Chicken Dry','Chinese Starters',210,35),
('Honey Chilli Chicken','Chinese Starters',230,36),
('Garlic Chicken','Chinese Starters',210,37),
('Crispy Fried Chicken','Chinese Starters',200,38),
('Chilli Fish','Chinese Starters',240,39),
('Golden Fried Prawns','Chinese Starters',290,40),
('Salt & Pepper Squid','Chinese Starters',300,41),
('Szechuan Mutton','Chinese Starters',320,42),
('Chicken Manchurian','Chinese Gravies',210,43),
('Kung Pao Chicken','Chinese Gravies',240,44),
('Chicken in Hot Garlic Sauce','Chinese Gravies',230,45),
('Chilli Chicken Gravy','Chinese Gravies',220,46),
('Schezwan Prawns','Chinese Gravies',310,47),
('Ginger Fish Gravy','Chinese Gravies',260,48),
('Black Pepper Mutton','Chinese Gravies',330,49),
('Sweet & Sour Chicken','Chinese Gravies',230,50),
('Chicken Fried Rice','Fried Rice & Noodles',180,51),
('Egg Fried Rice','Fried Rice & Noodles',150,52),
('Schezwan Chicken Fried Rice','Fried Rice & Noodles',200,53),
('Mixed Meat Fried Rice','Fried Rice & Noodles',240,54),
('Prawn Fried Rice','Fried Rice & Noodles',250,55),
('Chicken Hakka Noodles','Fried Rice & Noodles',180,56),
('Egg Noodles','Fried Rice & Noodles',150,57),
('Schezwan Chicken Noodles','Fried Rice & Noodles',200,58),
('Mixed Meat Noodles','Fried Rice & Noodles',240,59),
('Chicken Triple Schezwan Rice','Fried Rice & Noodles',260,60),
('Burnt Garlic Chicken Rice','Fried Rice & Noodles',210,61),
('Chicken Chopsuey','Fried Rice & Noodles',230,62),
('Chicken Dum Biryani','Biryani',220,63),
('Mutton Dum Biryani','Biryani',320,64),
('Ambur Chicken Biryani','Biryani',230,65),
('Dindigul Mutton Biryani','Biryani',340,66),
('Prawn Biryani','Biryani',300,67),
('Fish Biryani','Biryani',290,68),
('Egg Biryani','Biryani',160,69),
('Chicken 65 Biryani','Biryani',250,70),
('Bucket Biryani (Chicken)','Biryani',899,71),
('Bucket Biryani (Mutton)','Biryani',1299,72),
('Chettinad Chicken','Tamil Specials',250,73),
('Mutton Chukka','Tamil Specials',320,74),
('Nattu Kozhi Pepper Fry','Tamil Specials',340,75),
('Mutton Kola Urundai','Tamil Specials',280,76),
('Nethili Fry','Tamil Specials',220,77),
('Vanjaram Fish Fry','Tamil Specials',380,78),
('Crab Masala','Tamil Specials',360,79),
('Egg Kothu Parotta','Tamil Specials',150,80),
('Chicken Kothu Parotta','Tamil Specials',190,81),
('Mutton Kothu Parotta','Tamil Specials',230,82),
('Chicken Salna','Tamil Specials',160,83),
('Kuboos (2 pcs)','Breads',30,84),
('Malabar Parotta','Breads',30,85),
('Butter Naan','Breads',50,86),
('Garlic Naan','Breads',60,87),
('Ceylon Parotta','Breads',70,88),
('Chapati','Breads',25,89),
('Garlic Toum','Sides & Dips',30,90),
('Hummus','Sides & Dips',90,91),
('Mayonnaise Dip','Sides & Dips',30,92),
('French Fries','Sides & Dips',100,93),
('Peri Peri Fries','Sides & Dips',120,94),
('Arabic Salad','Sides & Dips',80,95),
('Kunafa','Desserts & Drinks',180,96),
('Umm Ali','Desserts & Drinks',150,97),
('Falooda','Desserts & Drinks',140,98),
('Fresh Lime Soda','Desserts & Drinks',60,99),
('Mint Lime','Desserts & Drinks',70,100),
('Arabian Mint Tea','Desserts & Drinks',50,101),
('Lassi','Desserts & Drinks',70,102),
('Soft Drink','Desserts & Drinks',40,103);