import "./index.css";
import "./shared/animations.css";
import "./shared/ui.css";
import { ProjectsApp } from "./em/emApp.js";
import { loadLegalInfo } from "./shared/legalInfo.js";

loadLegalInfo().catch(() => {});
new ProjectsApp(document.getElementById("root"));
