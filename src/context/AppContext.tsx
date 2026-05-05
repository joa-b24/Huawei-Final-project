import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TabId = "diagnostico" | "estructura" | "relaciones" | "temporal" | "datos";

export type ComparisonTarget =
  | "nacional"
  | "cluster_1"
  | "cluster_2"
  | "cluster_3"
  | "cluster_4"
  | "region_norte"
  | "region_centro"
  | "region_sur"
  | "region_occidente"
  | "region_bajio"
  | "region_noreste"
  | "region_noroeste"
  | "region_sureste"
  | "region_oriente";

export type AppState = {
  selectedStates: string[];
  primaryState: string | null;
  activeTab: TabId;
  comparisonTarget: ComparisonTarget;
  activeVariableIds: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

type Action =
  | { type: "TOGGLE_STATE"; stateName: string }
  | { type: "SET_STATES"; states: string[] }
  | { type: "SET_PRIMARY_STATE"; stateName: string | null }
  | { type: "SET_TAB"; tab: TabId }
  | { type: "SET_COMPARISON_TARGET"; target: ComparisonTarget }
  | { type: "TOGGLE_VARIABLE"; variableId: string }
  | { type: "SET_VARIABLES"; variableIds: string[] };

const MAX_ACTIVE_VARIABLES = 5;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "TOGGLE_STATE": {
      const already = state.selectedStates.includes(action.stateName);
      const next = already
        ? state.selectedStates.filter((s) => s !== action.stateName)
        : [...state.selectedStates, action.stateName];
      return {
        ...state,
        selectedStates: next,
        primaryState:
          state.primaryState === action.stateName && already
            ? (next[0] ?? null)
            : state.primaryState ?? action.stateName,
      };
    }
    case "SET_STATES":
      return {
        ...state,
        selectedStates: action.states,
        primaryState: action.states[0] ?? null,
      };
    case "SET_PRIMARY_STATE":
      return { ...state, primaryState: action.stateName };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_COMPARISON_TARGET":
      return { ...state, comparisonTarget: action.target };
    case "TOGGLE_VARIABLE": {
      const active = state.activeVariableIds.includes(action.variableId);
      if (active) {
        return { ...state, activeVariableIds: state.activeVariableIds.filter((v) => v !== action.variableId) };
      }
      if (state.activeVariableIds.length >= MAX_ACTIVE_VARIABLES) {
        return state;
      }
      return { ...state, activeVariableIds: [...state.activeVariableIds, action.variableId] };
    }
    case "SET_VARIABLES":
      return { ...state, activeVariableIds: action.variableIds.slice(0, MAX_ACTIVE_VARIABLES) };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_STATES = ["Nuevo Leon", "Jalisco", "Ciudad de Mexico", "Queretaro"];

const DEFAULT_VARIABLES = [
  "personas_usuarias_internet_pct",
  "localidades_con_4g_garantizada_pct",
  "pobreza_pct",
  "pib_per_capita",
  "poblacion_en_localidades_con_5g_garantizada_pct",
];

const initialState: AppState = {
  selectedStates: DEFAULT_STATES,
  primaryState: DEFAULT_STATES[0],
  activeTab: "diagnostico",
  comparisonTarget: "nacional",
  activeVariableIds: DEFAULT_VARIABLES,
};

type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<Action>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action creators (convenientes para no escribir objetos a mano en componentes)
// ─────────────────────────────────────────────────────────────────────────────

export const actions = {
  toggleState: (stateName: string): Action => ({ type: "TOGGLE_STATE", stateName }),
  setStates: (states: string[]): Action => ({ type: "SET_STATES", states }),
  setPrimaryState: (stateName: string | null): Action => ({ type: "SET_PRIMARY_STATE", stateName }),
  setTab: (tab: TabId): Action => ({ type: "SET_TAB", tab }),
  setComparisonTarget: (target: ComparisonTarget): Action => ({ type: "SET_COMPARISON_TARGET", target }),
  toggleVariable: (variableId: string): Action => ({ type: "TOGGLE_VARIABLE", variableId }),
  setVariables: (variableIds: string[]): Action => ({ type: "SET_VARIABLES", variableIds }),
};
