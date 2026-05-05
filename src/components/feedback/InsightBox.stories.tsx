import type { Meta, StoryObj } from "@storybook/react";
import InsightBox from "./InsightBox";

const meta: Meta<typeof InsightBox> = {
  component: InsightBox,
  title: "Feedback/InsightBox",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof InsightBox>;

export const WithTitle: Story = {
  args: {
    title: "Hallazgo clave",
    children: "Nuevo León lidera en conectividad digital con 91.3% de usuarios de internet, superando en 18.2 pp al promedio nacional.",
  },
};

export const WithoutTitle: Story = {
  args: {
    children: "Los estados del sur presentan brechas estructurales que no se explican únicamente por PIB per cápita.",
  },
};

export const MultiLine: Story = {
  args: {
    title: "Contexto metodológico",
    children: (
      <>
        <p style={{ margin: "0 0 8px" }}>Los datos de cobertura Ookla corresponden a Q1 2025.</p>
        <p style={{ margin: 0 }}>La teledensidad IFT es acumulada al cierre de 2024.</p>
      </>
    ),
  },
};
