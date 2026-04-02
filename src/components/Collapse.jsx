import React, { useState } from "react";
import "./Collapse.css";

const Collapse = ({ children, title, description, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={`collapse-card ${isOpen ? "is-open" : ""}`}>
      <button
        className="collapse-trigger"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
        <span className="collapse-indicator" aria-hidden="true">
          {isOpen ? "-" : "+"}
        </span>
      </button>
      <div className={`collapse-content ${isOpen ? "is-open" : ""}`}>
        {children}
      </div>
    </section>
  );
};

export default Collapse;
