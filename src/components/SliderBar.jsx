import React, { useEffect, useRef, useState } from "react";
import "./SliderBar.css";

export default function SlideBar({
  min = 0,
  max = 100,
  step = 10,
  initialData = 50,
  title = "unknown",
  onValueChange = () => {},
  backgroundType = "",
  commitOnRelease = false,
  formatValue = null,
}) {
  const [value, setValue] = useState(initialData);
  const didMountRef = useRef(false);

  useEffect(() => {
    setValue(initialData);
  }, [initialData]);

  useEffect(() => {
    if (commitOnRelease) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onValueChange(value);
  }, [commitOnRelease, value]);

  const commitValue = () => {
    if (!commitOnRelease) return;
    onValueChange(value);
  };

  const getBackgroundClass = () => {
    switch (backgroundType) {
      case "blueToYellow":
        return "bg-blue-to-yellow";
      case "greenToPurple":
        return "bg-green-to-purple";
      default:
        return "bg-neutral-track";
    }
  };

  const displayValue = formatValue ? formatValue(value) : value;

  return (
    <div className="slider-card">
      <div className="slider-card-head">
        <label htmlFor={title} className="slider-title">
          {title}
        </label>
        <span className="slider-value">{displayValue}</span>
      </div>
      <input
        id={title}
        onChange={(event) => setValue(parseFloat(event.target.value))}
        onPointerUp={commitValue}
        onKeyUp={commitValue}
        onBlur={commitValue}
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        className={`slider ${getBackgroundClass()}`}
      />
      <div className="slider-scale">
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
}
