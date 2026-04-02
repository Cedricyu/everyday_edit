import React from "react";

const CardButton = ({ children, onClick }) => (
  <button onClick={onClick} className="card-button" type="button">
    {children}
  </button>
);

export default CardButton;
