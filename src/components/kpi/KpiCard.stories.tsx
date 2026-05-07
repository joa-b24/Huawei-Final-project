import type { Meta, StoryObj } from "@storybook/react";
import KpiCard from "./KpiCard";

const meta: Meta<typeof KpiCard> = {
  component: KpiCard,
  title: "KPI/KpiCard",
  parameters: { layout: "padded" },
  args: {
    label: "Usuarios de internet",
    value: 78.3,
    tipoValor: "percentage",
    direction: "higher_better",
    delta: 5.2,
    isOutlier: false,
  },
};
export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Default: Story = {};

export const PositiveDelta: Story = {
  args: { delta: 8.4, direction: "higher_better" },
};

export const NegativeDelta: Story = {
  args: { delta: -3.1, direction: "higher_better" },
};

export const LowerBetter: Story = {
  args: {
    label: "Pobreza",
    value: 42.1,
    tipoValor: "percentage",
    direction: "lower_better",
    delta: -5.0,
  },
};

export const Outlier: Story = {
  args: { isOutlier: true, value: 97.2, delta: 22.1 },
};

export const Missing: Story = {
  args: { value: null, delta: null },
};

export const Currency: Story = {
  args: {
    label: "PIB per cápita",
    value: 0.43,
    tipoValor: "number",
    direction: "higher_better",
    delta: 0.07,
  },
};
