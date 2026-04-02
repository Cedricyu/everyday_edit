import React from "react";

const IconButton = ({ children, label, description, onClick }) => (
  <button onClick={onClick} className="tool-button" type="button">
    <span className="tool-button-icon">{children}</span>
    <span className="tool-button-copy">
      <strong>{label}</strong>
      <small>{description}</small>
    </span>
  </button>
);

export default IconButton;
