import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, UtensilsCrossed, Bike } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cartCount, cartTotal, formatINR, type Cart, type MenuItem } from "@/lib/cart";
import hero from "@/assets/hero.jpg";
import chinese from "@/assets/chinese.jpg";
import arabian from "@/assets/arabian.jpg";
import tamil from "@/assets/tamil.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DENMARK RESTAURANT — Arabian & Chinese Non-Veg in Tamil Nadu" },
      { name: "description", content: "Order authentic Arabian mandi, shawarma, alfaham and Chinese non-veg dishes online from Denmark Restaurant. Dine in or delivery." },
      { property: "og:title", content: "DENMARK RESTAURANT" },
      { property: "og:description", content: "Authentic Arabian & Chinese non-veg food in Tamil Nadu. Order online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").order("sort_order");
      if (error) throw error;
      return data as MenuItem[];
    },
  });
}

function Index() {
  const { data: menu = [], isLoading } = useMenu();
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const categories = useMemo(() => [...new Set(menu.map((m) => m.category))], [menu]);
  const count = cartCount(cart);
  const total = cartTotal(cart, menu);

  const change = (id: string, d: number) =>
    setCart((c) => {
      const n = Math.max(0, Math.min(50, (c[id] ?? 0) + d));
      const next = { ...c };
      if (n === 0) delete next[id];
      else next[id] = n;
      return next;
    });

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="relative h-[88vh] min-h-[560px] overflow-hidden">
        <img src={hero} alt="Arabian mandi, Chinese chilli chicken and biryani" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-fade" />
        <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
          <span className="font-display text-sm tracking-[0.3em] text-primary">EST. TAMIL NADU</span>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-primary">Owner</Link>
        </nav>
        <div className="relative z-10 flex h-[calc(100%-80px)] flex-col items-center justify-center px-6 text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.4em] text-primary">Authentic Non-Vegetarian</p>
          <h1 className="font-display text-5xl font-bold leading-tight text-gold md:text-8xl">DENMARK<br />RESTAURANT</h1>
          <p className="mt-6 max-w-xl text-lg text-foreground/85">Arabian grills & mandi, fiery Chinese wok classics — cooked the Tamil Nadu way.</p>
          <Button size="lg" className="mt-8 bg-gold text-primary-foreground shadow-glow hover:opacity-90" asChild>
            <a href="#menu">Order Now</a>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-3">
        {[
          { img: arabian, t: "Arabian", d: "Alfaham, Mandi, Shawarma" },
          { img: chinese, t: "Chinese", d: "Dragon chicken, noodles, fried rice" },
          { img: tamil, t: "Tamil Specials", d: "Biryani, Chettinad, Kothu" },
        ].map((c) => (
          <div key={c.t} className="group relative overflow-hidden rounded-xl border border-border">
            <img src={c.img} alt={c.t} loading="lazy" width={1024} height={768} className="h-64 w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-hero-fade" />
            <div className="absolute bottom-0 p-5">
              <h3 className="font-display text-2xl text-primary">{c.t}</h3>
              <p className="text-sm text-foreground/80">{c.d}</p>
            </div>
          </div>
        ))}
      </section>

      <main id="menu" className="mx-auto max-w-6xl px-6 pb-40">
        <h2 className="mb-2 text-center font-display text-4xl text-gold">Our Menu</h2>
        <p className="mb-8 text-center text-muted-foreground">Tap + to add dishes to your order</p>
        <div className="sticky top-0 z-20 -mx-6 mb-8 flex gap-2 overflow-x-auto bg-background/90 px-6 py-3 backdrop-blur">
          {categories.map((c) => (
            <a key={c} href={`#cat-${c}`} className="whitespace-nowrap rounded-full border border-border px-4 py-1.5 text-sm hover:border-primary hover:text-primary">{c}</a>
          ))}
        </div>
        {isLoading && <p className="text-center text-muted-foreground">Loading menu…</p>}
        {categories.map((cat) => (
          <section key={cat} id={`cat-${cat}`} className="mb-12 scroll-mt-20">
            <h3 className="mb-4 border-b border-border pb-2 font-display text-2xl text-primary">{cat}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {menu.filter((m) => m.category === cat).map((m) => {
                const q = cart[m.id] ?? 0;
                return (
                  <div key={m.id} className={`flex items-center justify-between rounded-lg border bg-card p-4 ${q ? "border-primary" : "border-border"} ${m.available ? "" : "opacity-50"}`}>
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-sm text-primary">{formatINR(m.price)}</p>
                    </div>
                    {!m.available ? (
                      <span className="text-xs text-muted-foreground">Sold out</span>
                    ) : q === 0 ? (
                      <Button size="sm" onClick={() => change(m.id, 1)} className="bg-gold text-primary-foreground">
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => change(m.id, -1)} aria-label={`Remove ${m.name}`}><Minus className="h-4 w-4" /></Button>
                        <span className="w-6 text-center font-bold">{q}</span>
                        <Button size="icon" className="h-8 w-8 bg-gold text-primary-foreground" onClick={() => change(m.id, 1)} aria-label={`Add ${m.name}`}><Plus className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      {count > 0 && (
        <button onClick={() => setOpen(true)} className="fixed bottom-6 left-1/2 z-30 flex w-[min(92vw,480px)] -translate-x-1/2 items-center justify-between rounded-full bg-gold px-6 py-4 font-semibold text-primary-foreground shadow-glow">
          <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> {count} item{count > 1 ? "s" : ""}</span>
          <span>{formatINR(total)} · View order</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="font-display text-primary">Your Order</SheetTitle></SheetHeader>
          <Checkout menu={menu} cart={cart} change={change} total={total} onDone={() => { setCart({}); setOpen(false); }} />
        </SheetContent>
      </Sheet>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © DENMARK RESTAURANT · Tamil Nadu
      </footer>
    </div>
  );
}

function Checkout({ menu, cart, change, total, onDone }: { menu: MenuItem[]; cart: Cart; change: (id: string, d: number) => void; total: number; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"dine_in" | "delivery" | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<number | null>(null);
  const lines = menu.filter((m) => cart[m.id]);

  const submit = async () => {
    if (!name.trim() || phone.trim().length < 6) return toast.error("Please enter your name and phone number");
    if (!type) return toast.error("Choose Dine In or Delivery");
    if (type === "delivery" && !address.trim()) return toast.error("Please enter delivery address");
    setBusy(true);
    const id = crypto.randomUUID();
    const { error } = await supabase.from("orders").insert({
      id,
      customer_name: name.trim().slice(0, 100),
      phone: phone.trim().slice(0, 20),
      order_type: type,
      address: type === "delivery" ? address.trim().slice(0, 500) : null,
      notes: notes.trim().slice(0, 500) || null,
      items: lines.map((l) => ({ id: l.id, qty: cart[l.id] })),
    });
    setBusy(false);
    if (error) return toast.error("Could not place order. Please try again.");
    setPlaced(1);
  };

  if (placed)
    return (
      <div className="py-12 text-center">
        <p className="font-display text-2xl text-gold">Order received!</p>
        <p className="mt-3 text-muted-foreground">The restaurant has been notified. We'll call you at {phone} shortly.</p>
        <Button className="mt-6 bg-gold text-primary-foreground" onClick={onDone}>Done</Button>
      </div>
    );

  return (
    <div className="mt-4 space-y-5 pb-8">
      <div className="space-y-2">
        {lines.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-sm">
            <span className="flex-1">{l.name}</span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => change(l.id, -1)}><Minus className="h-3 w-3" /></Button>
              <span className="w-5 text-center">{cart[l.id]}</span>
              <Button size="icon" variant="secondary" className="h-6 w-6" onClick={() => change(l.id, 1)}><Plus className="h-3 w-3" /></Button>
            </div>
            <span className="w-20 text-right">{formatINR(l.price * cart[l.id])}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-2 font-bold text-primary"><span>Total</span><span>{formatINR(total)}</span></div>
      </div>
      <Input placeholder="Your name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Phone number" type="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} />
      <div>
        <p className="mb-2 text-sm font-semibold">How would you like your order?</p>
        <div className="grid grid-cols-2 gap-3">
          {([["dine_in", "DINE IN", UtensilsCrossed], ["delivery", "DELIVERY", Bike]] as const).map(([v, label, Icon]) => (
            <button key={v} onClick={() => setType(v)} className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 font-display font-bold ${type === v ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
              <Icon className="h-6 w-6" /> {label}
            </button>
          ))}
        </div>
      </div>
      {type === "delivery" && <Textarea placeholder="Delivery address" value={address} maxLength={500} onChange={(e) => setAddress(e.target.value)} />}
      <Textarea placeholder="Notes (spice level, etc.) — optional" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
      <Button disabled={busy || lines.length === 0} onClick={submit} className="w-full bg-gold py-6 text-base text-primary-foreground shadow-glow">
        {busy ? "Placing order…" : `Place Order · ${formatINR(total)}`}
      </Button>
    </div>
  );
}
