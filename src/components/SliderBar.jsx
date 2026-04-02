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
}) {
  const [value, setValue] = useState(initialData);
  const didMountRef = useRef(false);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    onValueChange(value);
  }, [value]);

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

  return (
    <div className="slider-card">
      <div className="slider-card-head">
        <label htmlFor={title} className="slider-title">
          {title}
        </label>
        <span className="slider-value">{value}</span>
      </div>
      <input
        id={title}
        onChange={(event) => setValue(parseFloat(event.target.value))}
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        className={`slider ${getBackgroundClass()}`}
      />
      <div className="slider-scale">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
