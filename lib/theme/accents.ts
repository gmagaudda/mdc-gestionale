export const accents = ["green", "blue", "violet", "neutral"] as const;
export type Accent = (typeof accents)[number];
export const accentStorageKey = "mdc-accent";
export const accentScript = `try{var a=localStorage.getItem(${JSON.stringify(accentStorageKey)});if(${JSON.stringify(accents)}.includes(a))document.documentElement.dataset.accent=a}catch{}`;
