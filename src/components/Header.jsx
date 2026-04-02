import React from "react";

const Header = () => {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div>
          <p className="site-kicker">Everyday Edit</p>
          <h1 className="site-title">Image Editing Workbench for Contrast, Color, and Custom Filters</h1>
        </div>
        <p className="site-subtitle">
          Experiment with OpenCV-based adjustments, compare results, and build
          your own image-processing workflow in the browser.
        </p>
      </div>
    </header>
  );
};

export default Header;
