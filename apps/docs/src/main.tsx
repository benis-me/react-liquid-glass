import { createRoot } from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import { App } from "./App";
import { loadChineseFont } from "./fonts";
import "./styles.css";

try { if (localStorage.getItem("glass-locale") === "zh") void loadChineseFont(); } catch { /* The app loads it on switch. */ }
// Local QA can compare backends without adding implementation controls to the site.
const renderer = import.meta.env.DEV ? new URLSearchParams(location.search).get("renderer") : null;
createRoot(document.getElementById("root")!).render(<App backend={renderer === "webgl2" || renderer === "webgpu" ? renderer : "auto"} />);
