/**
 * Type stub for @react-native-community/slider — allows the Slider UI
 * component to compile even when the native package is not installed.
 * At runtime, the require() is wrapped in try/catch and falls back to
 * a read-only bar.
 */
declare module "@react-native-community/slider" {
  import { Component } from "react";
  interface SliderProps {
    value?: number;
    minimumValue?: number;
    maximumValue?: number;
    step?: number;
    onValueChange?: (value: number) => void;
    minimumTrackTintColor?: string;
    maximumTrackTintColor?: string;
    thumbTintColor?: string;
    style?: unknown;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  class Slider extends Component<SliderProps> {}
  export default Slider;
}