import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignore: [
    // shadcn/ui pre-installed component library – not all components need to be
    // imported at once, so treat them as library files rather than dead code.
    "src/components/ui/**",
    "src/hooks/use-mobile.ts",
    // Auto-generated Supabase type definitions.
    "src/types/schema.gen.ts",
  ],
  ignoreDependencies: [
    // All Radix UI packages and shadcn/ui companion libraries are consumed
    // exclusively by the ignored src/components/ui/** files.
    "@radix-ui/react-accordion",
    "@radix-ui/react-aspect-ratio",
    "@radix-ui/react-avatar",
    "@radix-ui/react-checkbox",
    "@radix-ui/react-collapsible",
    "@radix-ui/react-context-menu",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-hover-card",
    "@radix-ui/react-menubar",
    "@radix-ui/react-navigation-menu",
    "@radix-ui/react-popover",
    "@radix-ui/react-progress",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-separator",
    "@radix-ui/react-slider",
    "@radix-ui/react-switch",
    "@radix-ui/react-tabs",
    "@radix-ui/react-tooltip",
    "@radix-ui/react-visually-hidden",
    "cmdk",
    "date-fns",
    "embla-carousel-react",
    "input-otp",
    "next-themes",
    "react-day-picker",
    "react-resizable-panels",
    "recharts",
    "sonner",
    "vaul",
    // CLI / Prettier plugin – referenced inside package.json scripts but not
    // imported as an ES module, so knip cannot detect its usage.
    "prettier-plugin-sh",
    // Supabase CLI – used as a dev-time CLI tool (e.g. `supabase db push`).
    "supabase",
    // postcss is a peer dependency resolved transitively through
    // @tailwindcss/postcss; it is not imported directly in source code.
    "postcss",
  ],
};

export default config;
