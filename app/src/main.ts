import { createApp } from "vue";
import PrimeVue from "primevue/config";
import Aura from "@primeuix/themes/aura";
import { definePreset } from "@primeuix/themes";
import Badge from "primevue/badge";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";
import AutoComplete from "primevue/autocomplete";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import Message from "primevue/message";
import Toast from "primevue/toast";
import "primeicons/primeicons.css";

import App from "./App.vue";
import "./styles.css";

const primitiveColors = {
  blue: {
    50: "#eef8ff",
    100: "#d9efff",
    200: "#bbe3ff",
    300: "#8cd3ff",
    400: "#56baff",
    500: "#2f9cff",
    600: "#187ff8",
    700: "#1167e4",
    800: "#1555bd",
    900: "#174891",
    950: "#132d58"
  },
  lime: {
    50: "#f7fee7",
    100: "#ecfbcc",
    200: "#d8f79f",
    300: "#bef066",
    400: "#a9e546",
    500: "#84c919",
    600: "#65a010",
    700: "#4d7a11",
    800: "#3f6113",
    900: "#365215",
    950: "#1a2d06"
  }
};

const AppPreset = definePreset(Aura, {
  primitive: primitiveColors,
  semantic: {
    primary: {
      50: "{blue.50}",
      100: "{blue.100}",
      200: "{blue.200}",
      300: "{blue.300}",
      400: "{blue.400}",
      500: "{blue.500}",
      600: "{blue.600}",
      700: "{blue.700}",
      800: "{blue.800}",
      900: "{blue.900}",
      950: "{blue.950}"
    },
    accent: {
      50: "{violet.50}",
      100: "{violet.100}",
      200: "{violet.200}",
      300: "{violet.300}",
      400: "{violet.400}",
      500: "{violet.500}",
      600: "{violet.600}",
      700: "{violet.700}",
      800: "{violet.800}",
      900: "{violet.900}",
      950: "{violet.950}"
    },
    secondary: {
      50: "{lime.50}",
      100: "{lime.100}",
      200: "{lime.200}",
      300: "{lime.300}",
      400: "{lime.400}",
      500: "{lime.500}",
      600: "{lime.600}",
      700: "{lime.700}",
      800: "{lime.800}",
      900: "{lime.900}",
      950: "{lime.950}"
    },
    success: {
      50: "{green.50}",
      100: "{green.100}",
      200: "{green.200}",
      300: "{green.300}",
      400: "{green.400}",
      500: "{green.500}",
      600: "{green.600}",
      700: "{green.700}",
      800: "{green.800}",
      900: "{green.900}",
      950: "{green.950}"
    },
    error: {
      50: "{rose.50}",
      100: "{rose.100}",
      200: "{rose.200}",
      300: "{rose.300}",
      400: "{rose.400}",
      500: "{rose.500}",
      600: "{rose.600}",
      700: "{rose.700}",
      800: "{rose.800}",
      900: "{rose.900}",
      950: "{rose.950}"
    },
    colorScheme: {
      light: {
        primary: {
          color: "{primary.800}",
          contrastColor: "#ffffff",
          hoverColor: "{primary.700}",
          activeColor: "{primary.900}"
        },
        accent: {
          color: "{accent.400}",
          contrastColor: "{surface.950}",
          hoverColor: "{accent.500}",
          activeColor: "{accent.600}"
        },
        secondary: {
          color: "{secondary.400}",
          contrastColor: "{secondary.950}",
          hoverColor: "{secondary.500}",
          activeColor: "{secondary.600}"
        },
        success: {
          color: "{success.500}",
          contrastColor: "#ffffff",
          hoverColor: "{success.600}",
          activeColor: "{success.700}"
        },
        error: {
          color: "{error.500}",
          contrastColor: "#ffffff",
          hoverColor: "{error.600}",
          activeColor: "{error.700}"
        },
        surface: {
          0: "#FFFFFF",
          50: "#F8FAFC",
          100: "#E0F2FE",
          200: "#F5F3FF",
          300: "#F1F6E9",
          400: "#CBD5E1",
          500: "#94A3B8",
          600: "#64748B",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617"
        }
      }
    }
  },
  components: {
    toast: {
      root: {
        width: 'calc(100% - 2.5rem)'
      }
    }
  }
});

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: AppPreset,
    options: {
      darkModeSelector: false
    }
  },
  inputVariant: "filled",
  ripple: true
});
app.use(ToastService);
app.use(ConfirmationService);
app.component("AutoComplete", AutoComplete);
app.component("Badge", Badge);
app.component("Button", Button);
app.component("ConfirmDialog", ConfirmDialog);
app.component("Message", Message);
app.component("Toast", Toast);
app.directive("tooltip", Tooltip);

app.mount("#app");
