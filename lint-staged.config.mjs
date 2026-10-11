const owned = files => files.filter(file => !file.includes("/components/arc/") && !file.includes("/.agents/skills/"));
const quote = files => files.map(file => `"${file.replaceAll('"', '\\"')}"`).join(" ");
export default {
  "*.{js,jsx,ts,tsx,json,css,md}": files => {
    const selected = owned(files);
    return selected.length ? `prettier --write ${quote(selected)}` : [];
  },
  "*.{js,jsx,ts,tsx}": files => {
    const selected = owned(files);
    return selected.length ? `eslint --fix ${quote(selected)}` : [];
  },
};
