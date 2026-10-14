import { useEffect, useState } from "react";
import Landing from "./pages/Landing";
import Studio from "./pages/Studio";
import { THEME_KEY, usePersistent } from "./lib/store";

type Route = "landing" | "studio";
const readRoute = (): Route => (window.location.hash.startsWith("#/studio") ? "studio" : "landing");

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [theme, setTheme] = usePersistent<"light" | "dark">(THEME_KEY, () => "light");

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    const dark = route === "studio" && theme === "dark";
    document.documentElement.classList.toggle("dark", dark);
  }, [theme, route]);

  const go = (r: Route) => {
    window.location.hash = r === "studio" ? "#/studio" : "#/";
    setRoute(r);
    window.scrollTo(0, 0);
  };

  return route === "studio" ? (
    <div className="h-screen overflow-hidden">
      <Studio dark={theme === "dark"} onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} onHome={() => go("landing")} />
    </div>
  ) : (
    <Landing onStart={() => go("studio")} />
  );
}
