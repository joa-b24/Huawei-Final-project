import type { Preview } from "@storybook/react";
import "../src/styles/global.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dashboard",
      values: [
        { name: "dashboard", value: "#f3f4f6" },
        { name: "white", value: "#ffffff" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date/i,
      },
    },
  },
};

export default preview;
