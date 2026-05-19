import { execSync } from "child_process";

const packages = [
  "qrcode.react",
  "html5-qrcode",
  "jspdf",
  "jspdf-autotable",
  "react-csv",
  "@types/react-csv",
];

console.log("Installing packages:", packages.join(", "));

try {
  execSync(`npm install ${packages.join(" ")} --legacy-peer-deps`, {
    cwd: "/vercel/share/v0-project",
    stdio: "inherit",
  });
  console.log("All packages installed successfully.");
} catch (err) {
  console.error("Installation failed:", err.message);
  process.exit(1);
}
