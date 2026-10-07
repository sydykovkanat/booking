import { createCn } from "cn/config"

// Teach the merger about the kit's custom tokens (globals.css) so overrides
// like `shadow-none`, `z-10` or `duration-300` replace them instead of
// stacking.
const cn = createCn({
  extend: {
    theme: {
      shadow: ["card", "popover", "glass", "floating"],
      // Font sizes from globals.css; without this they read as text colours
      // and get dropped next to `text-foreground` & co.
      text: ["lead", "ui", "ui-sm", "caption"],
    },
    classGroups: {
      z: [{ z: ["sticky", "scrollbar", "overlay", "tooltip", "toast"] }],
      duration: [{ duration: ["instant", "fast", "base", "slow"] }],
    },
  },
})

export { cn }
