import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Bell, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR, type MenuItem } from "@/lib/cart";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Owner Dashboard — DENMARK RESTAURANT" },
      { name: "description", content: "Manage incoming orders and the menu for Denmark Restaurant." },
      { property: "og:title", content: "Owner Dashboard — DENMARK RESTAURANT" },
      { property: "og:description", content: "Manage orders and menu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type Order = {
  id: string; order_number: number; customer_name: string; phone: string; order_type: string;
  address: string | null; notes: string | null; items: { name: string; qty: number; price: number }[];
  total: number; status: string; created_at: string;
};

function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (!ready) return null;
  if (!session) return <Login />;
  if (isAdmin === null) return <Shell><p>Checking access…</p></Shell>;
  if (!isAdmin) return <Shell><p>This account is not the restaurant owner.</p><Button className="mt-4" onClick={() => supabase.auth.signOut()}>Sign out</Button></Shell>;

  return (
    <div className="min-h-screen bg-background p-6 font-sans text-foreground">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl text-gold">DENMARK · Owner</h1>
          <div className="flex gap-2">
            <Button variant="secondary" asChild><Link to="/">View site</Link></Button>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>Sign out</Button>
          </div>
        </div>
        <Tabs defaultValue="orders">
          <TabsList><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="menu">Menu</TabsTrigger></TabsList>
          <TabsContent value="orders"><Orders /></TabsContent>
          <TabsContent value="menu"><MenuEditor /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground"><div className="w-full max-w-sm rounded-xl border border-border bg-card p-6">{children}</div></div>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const go = async () => {
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
    if (error) return toast.error(error.message);
    if (mode === "up") toast.success("Check your email to confirm your account.");
  };
  return (
    <Shell>
      <h1 className="mb-4 font-display text-2xl text-gold">Owner {mode === "in" ? "Sign in" : "Sign up"}</h1>
      <div className="space-y-3">
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button className="w-full bg-gold text-primary-foreground" onClick={go}>{mode === "in" ? "Sign in" : "Create account"}</Button>
        <button className="w-full text-xs text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "First time? Create the owner account" : "Have an account? Sign in"}
        </button>
      </div>
    </Shell>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* ignore */ }
}

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const loaded = useRef(false);
  const load = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    setOrders((data ?? []) as unknown as Order[]);
  };
  useEffect(() => {
    load().then(() => { loaded.current = true; });
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    const ch = supabase.channel("orders-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const o = p.new as Order;
        beep();
        toast.success(`New order #${o.order_number} · ${o.order_type === "dine_in" ? "DINE IN" : "DELIVERY"} · ${formatINR(o.total)}`);
        if (typeof Notification !== "undefined" && Notification.permission === "granted")
          new Notification("New order — DENMARK", { body: `${o.customer_name} · ${formatINR(o.total)}` });
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    load();
  };

  return (
    <div className="mt-4 space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Bell className="h-4 w-4 text-primary" /> Keep this page open — new orders ring and pop up instantly.</p>
      {orders.length === 0 && <p className="text-muted-foreground">No orders yet.</p>}
      {orders.map((o) => (
        <div key={o.id} className={`rounded-lg border bg-card p-4 ${o.status === "new" ? "border-primary" : "border-border"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-display text-lg text-primary">#{o.order_number}</span>
              <span className={`ml-3 rounded px-2 py-0.5 text-xs font-bold ${o.order_type === "dine_in" ? "bg-secondary" : "bg-accent text-accent-foreground"}`}>{o.order_type === "dine_in" ? "DINE IN" : "DELIVERY"}</span>
              <span className="ml-3 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</span>
            </div>
            <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className="rounded border border-input bg-background px-2 py-1 text-sm">
              {["new", "preparing", "completed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <p className="mt-2 text-sm"><b>{o.customer_name}</b> · <a href={`tel:${o.phone}`} className="text-primary">{o.phone}</a></p>
          {o.address && <p className="text-sm text-muted-foreground">📍 {o.address}</p>}
          {o.notes && <p className="text-sm text-muted-foreground">📝 {o.notes}</p>}
          <ul className="mt-2 text-sm">
            {o.items.map((i, k) => <li key={k}>{i.qty} × {i.name} — {formatINR(i.price * i.qty)}</li>)}
          </ul>
          <p className="mt-2 font-bold text-primary">Total {formatINR(o.total)}</p>
        </div>
      ))}
    </div>
  );
}

function MenuEditor() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [n, setN] = useState({ name: "", category: "", price: "" });
  const load = async () => {
    const { data } = await supabase.from("menu_items").select("*").order("sort_order");
    setItems((data ?? []) as MenuItem[]);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<MenuItem>) => {
    const { error } = await supabase.from("menu_items").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this dish?")) return;
    await supabase.from("menu_items").delete().eq("id", id); load();
  };
  const add = async () => {
    const price = Number(n.price);
    if (!n.name.trim() || !n.category.trim() || !(price >= 0)) return toast.error("Fill name, category and price");
    const { error } = await supabase.from("menu_items").insert({ name: n.name.trim(), category: n.category.trim(), price, sort_order: items.length + 1 });
    if (error) return toast.error(error.message);
    setN({ name: "", category: "", price: "" }); load(); toast.success("Dish added");
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-2 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <Input placeholder="Dish name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <Input placeholder="Category" list="cats" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })} />
        <datalist id="cats">{[...new Set(items.map((i) => i.category))].map((c) => <option key={c} value={c} />)}</datalist>
        <Input placeholder="Price ₹" type="number" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} />
        <Button className="bg-gold text-primary-foreground" onClick={add}>Add dish</Button>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="grid grid-cols-[1fr_9rem_6rem_auto_auto] items-center gap-2 rounded border border-border bg-card p-2">
            <Input defaultValue={i.name} onBlur={(e) => e.target.value !== i.name && update(i.id, { name: e.target.value })} />
            <Input defaultValue={i.category} onBlur={(e) => e.target.value !== i.category && update(i.id, { category: e.target.value })} />
            <Input type="number" defaultValue={i.price} onBlur={(e) => Number(e.target.value) !== Number(i.price) && update(i.id, { price: Number(e.target.value) })} />
            <Switch checked={i.available} onCheckedChange={(v) => update(i.id, { available: v })} aria-label="Available" />
            <Button size="icon" variant="ghost" onClick={() => remove(i.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
