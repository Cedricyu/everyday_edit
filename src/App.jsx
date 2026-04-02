import React, { useEffect, useRef, useState } from "react";
import cv from "@techstark/opencv-js";
import Card from "./components/Card.jsx";
import CardButton from "./components/CardButton.jsx";
import Collapse from "./components/Collapse.jsx";
import Header from "./components/Header.jsx";
import IconButton from "./components/IconButton.jsx";
import ImageUploader from "./components/ImageUpload.jsx";
import SlideBar from "./components/SliderBar.jsx";
import filter from "./js/filter.js";
import "./page.css";

const DEBUG = 0;

function RefreshIcon() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17.651 7.65a7.131 7.131 0 0 0-12.68 3.15M18.001 4v4h-4m-7.652 8.35a7.13 7.13 0 0 0 12.68-3.15M6 20v-4h4" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 5v4m0 10v-4m7-3h-4M9 12H5m11.364-4.95-2.829 2.828M10.465 13.536l-2.829 2.829m8.728 0-2.829-2.829M10.465 10.464 7.636 7.636" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 13V4m0 0-3 3m3-3 3 3M8 16H6a2 2 0 0 0-2 2v1h16v-1a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

export default function App() {
  const [src, setSrc] = useState(null);
  const [currentMat, setCurrentMat] = useState(null);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(127);
  const [saturation, setSaturation] = useState(1);
  const [shadow, setShadow] = useState(1);
  const [light, setLight] = useState(1);
  const [tempature, setTempature] = useState(1);
  const [imageList, setImageList] = useState([]);
  const [histogramReady, setHistogramReady] = useState(false);
  const [levelsRange, setLevelsRange] = useState({ black: 0, white: 255 });
  const canvasRef = useRef(null);
  const histCanvas = useRef(null);
  const levelsBaseImageRef = useRef(null);

  const replaceCurrentMat = (nextMat) => {
    setCurrentMat((previousMat) => {
      if (previousMat && previousMat !== nextMat) {
        try {
          previousMat.delete();
        } catch {
          // Ignore stale wasm handles.
        }
      }
      return nextMat;
    });
  };

  const hasRenderableImage = () => {
    if (!canvasRef.current || !currentMat) return false;

    try {
      return !currentMat.empty();
    } catch {
      return false;
    }
  };

  const captureLevelsBaseImage = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvasRef.current.width || !canvasRef.current.height) return;
    levelsBaseImageRef.current = ctx.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height,
    );
  };

  const resetLevels = () => {
    setLevelsRange({ black: 0, white: 255 });
    captureLevelsBaseImage();
  };

  const drawHistogramHandles = (ctx, width, height) => {
    const leftX = (levelsRange.black / 255) * width;
    const rightX = (levelsRange.white / 255) * width;

    ctx.fillStyle = "rgba(221, 171, 95, 0.14)";
    ctx.fillRect(0, 0, leftX, height);
    ctx.fillRect(rightX, 0, width - rightX, height);
  };

  const drawDefaultBackground = (callback) => {
    const canvas = histCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#4f4536";
    ctx.font = "600 18px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Histogram will appear here", canvas.width / 2, canvas.height / 2);
    if (callback) callback();
  };

  const drawHistGram = (flag = cv.COLOR_RGBA2GRAY) => {
    if (!cv || !cv.imread || !hasRenderableImage()) return;

    let srcMat;
    let hist;
    let mask;
    let srcVec;

    try {
      srcMat = new cv.Mat();
      cv.cvtColor(currentMat, srcMat, flag, 4);
      hist = new cv.Mat();
      mask = new cv.Mat();
      srcVec = new cv.MatVector();
      srcVec.push_back(srcMat);
      cv.calcHist(srcVec, [0], mask, hist, [256], [0, 255], false);
      const result = cv.minMaxLoc(hist, mask);
      const max = result.maxVal || 1;
      const canvas = histCanvas.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const width = canvas.width;
      const height = canvas.height;
      const binWidth = width / 256;
      ctx.fillStyle = "#fbf7f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#cfb998";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 1);
      ctx.lineTo(width, height - 1);
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(width, height * 0.5);
      ctx.stroke();
      ctx.strokeStyle = "#352b1f";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 256; i += 1) {
        const binVal = (hist.data32F[i] * height) / max;
        if (i === 0) ctx.moveTo(i * binWidth + binWidth / 2, height - binVal);
        else ctx.lineTo(i * binWidth + binWidth / 2, height - binVal);
      }
      ctx.stroke();
      drawHistogramHandles(ctx, width, height);
    } catch (error) {
      console.error("Failed to draw histogram:", error);
    } finally {
      try {
        srcMat?.delete();
        hist?.delete();
        mask?.delete();
        srcVec?.delete();
      } catch {
        // Ignore cleanup errors from released mats.
      }
    }
  };

  useEffect(() => {
    cv.onRuntimeInitialized = () => replaceCurrentMat(new cv.Mat());
  }, []);

  useEffect(() => {
    if (!src) {
      drawDefaultBackground(() => setHistogramReady(true));
      return;
    }
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      resetLevels();
      const mat = cv.imread(canvas);
      replaceCurrentMat(mat);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (hasRenderableImage()) drawHistGram();
  }, [currentMat]);

  const redrawImage = (image) => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      resetLevels();
      const mat = cv.imread(canvas);
      replaceCurrentMat(mat);
    };
    img.src = image;
  };

  const loadMatFromImage = (image) =>
    new Promise((resolve, reject) => {
      if (!canvasRef.current || !image) {
        reject(new Error("No source image available."));
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(cv.imread(canvas));
      };

      img.onerror = () => {
        reject(new Error("Failed to load source image."));
      };

      img.src = image;
    });

  const refresh = () => {
    if (!src) return;
    redrawImage(src);
  };

  const handleImageChange = (image) => {
    if (DEBUG) return;
    setSrc(image);
    redrawImage(image);
  };

  const handleReset = () => {
    setBrightness(1);
    setContrast(127);
    setSaturation(1);
    setShadow(1);
    setLight(1);
    setTempature(1);
    refresh();
  };

  const handleExport = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "everyday-edit-export.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const applyAndRender = (nextMat) => {
    if (!canvasRef.current || !nextMat || nextMat.empty()) return;
    try {
      cv.imshow(canvasRef.current, nextMat);
      resetLevels();
      replaceCurrentMat(nextMat);
    } catch (error) {
      console.error("Failed to display image on canvas:", error);
    }
  };

  const applyLevelsToCanvas = (black, white) => {
    if (!canvasRef.current || !levelsBaseImageRef.current || white <= black) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const source = levelsBaseImageRef.current;
    const adjusted = new ImageData(
      new Uint8ClampedArray(source.data),
      source.width,
      source.height,
    );
    const scale = 255 / (white - black);

    for (let i = 0; i < adjusted.data.length; i += 4) {
      adjusted.data[i] = Math.max(0, Math.min(255, (adjusted.data[i] - black) * scale));
      adjusted.data[i + 1] = Math.max(
        0,
        Math.min(255, (adjusted.data[i + 1] - black) * scale),
      );
      adjusted.data[i + 2] = Math.max(
        0,
        Math.min(255, (adjusted.data[i + 2] - black) * scale),
      );
    }

    ctx.putImageData(adjusted, 0, 0);

    try {
      const mat = cv.imread(canvas);
      replaceCurrentMat(mat);
    } catch (error) {
      console.error("Failed to update canvas levels:", error);
    }
  };

  const updateLevels = (nextBlack, nextWhite) => {
    if (!hasRenderableImage()) return;

    const safeBlack = Math.max(0, Math.min(nextBlack, nextWhite - 1));
    const safeWhite = Math.min(255, Math.max(nextWhite, safeBlack + 1));

    setLevelsRange({ black: safeBlack, white: safeWhite });
    applyLevelsToCanvas(safeBlack, safeWhite);
  };

  const applyFilterFromSource = async (filterFn) => {
    if (!src || !canvasRef.current) return;

    try {
      const baseMat = await loadMatFromImage(src);
      const nextMat = filterFn(baseMat);
      baseMat.delete();
      applyAndRender(nextMat);
    } catch (error) {
      console.error("Failed to apply filter from source image:", error);
    }
  };

  const handleAESHE = () => {
    void applyFilterFromSource((baseMat) => filter.AESHE(baseMat));
  };

  const handleCLAHE = () => {
    void applyFilterFromSource((baseMat) => filter.CLAHE(baseMat));
  };

  const handleWinter = () => {
    void applyFilterFromSource((baseMat) => filter.Winter(baseMat));
  };

  const handleSummmer = () => {
    void applyFilterFromSource((baseMat) => filter.Summer(baseMat));
  };

  const handleColorMix = () => {
    void applyFilterFromSource((baseMat) => {
      const tmp = cv.imread("img");
      return filter.processImages(baseMat, tmp);
    });
  };

  const handleTempature = (tempatureValue) => {
    if (!hasRenderableImage()) return;
    const dst = filter.adjustColorTemperature(currentMat, tempatureValue - tempature);
    setTempature(tempatureValue);
    applyAndRender(dst);
  };

  const handleBrightness = (newBrightness) => {
    if (!hasRenderableImage()) return;
    const dstMat = new cv.Mat();
    currentMat.convertTo(dstMat, -1, 1, newBrightness - brightness);
    if (dstMat.empty()) return;
    applyAndRender(dstMat);
    setBrightness(newBrightness);
  };

  const handleContrast = (contrastValue) => {
    if (!hasRenderableImage()) return;
    const dst = new cv.Mat();
    const normalized = contrastValue / 255.0;
    const k = Math.tan(((45 + 44 * normalized) * Math.PI) / 180);
    currentMat.convertTo(dst, cv.CV_8U, k, 127.5 * -k + 127.5);
    applyAndRender(dst);
    setContrast(contrastValue);
  };

  const handleColorSaturation = (saturationValue) => {
    if (!hasRenderableImage()) return;
    const canvas = canvasRef.current;
    const hsvMat = new cv.Mat();
    cv.cvtColor(currentMat, hsvMat, cv.COLOR_RGB2HSV, 4);
    const lutWeaken = new cv.Mat(256, 1, cv.CV_8UC1);
    for (let i = 0; i < 256; i += 1) lutWeaken.data[i] = Math.max(Math.min(255, i * saturationValue), 0);
    const channels = new cv.MatVector();
    cv.split(hsvMat, channels);
    const tmp = new cv.Mat();
    cv.LUT(channels.get(1), lutWeaken, tmp);
    channels.set(1, tmp);
    const dst = new cv.Mat();
    cv.merge(channels, dst);
    cv.cvtColor(dst, dst, cv.COLOR_HSV2RGB, 4);
    try {
      cv.imshow(canvas, dst);
      setCurrentMat(dst);
    } catch (error) {
      console.error("Failed to display image on canvas:", error);
    }
    hsvMat.delete();
    lutWeaken.delete();
    channels.delete();
    tmp.delete();
    setSaturation(saturationValue);
  };

  const handleShadow = (shadowValue) => {
    if (!hasRenderableImage()) return;
    const grayscaleMat = new cv.Mat();
    cv.cvtColor(currentMat, grayscaleMat, cv.COLOR_RGBA2GRAY, 4);
    const thresholdMat = new cv.Mat();
    cv.adaptiveThreshold(grayscaleMat, thresholdMat, 200, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 999, 2);
    const dstMat = new cv.Mat();
    cv.cvtColor(thresholdMat, dstMat, cv.COLOR_GRAY2RGBA, 4);
    try {
      cv.addWeighted(currentMat, 1.0, dstMat, shadowValue, 0, dstMat);
      cv.imshow(canvasRef.current, dstMat);
      setCurrentMat(dstMat);
    } catch (error) {
      console.error("Failed to display image on canvas:", error);
    } finally {
      grayscaleMat.delete();
      thresholdMat.delete();
    }
    setShadow(shadowValue);
  };

  const handleLight = (lightValue) => {
    if (!hasRenderableImage()) return;
    const grayscaleMat = new cv.Mat();
    cv.cvtColor(currentMat, grayscaleMat, cv.COLOR_RGBA2GRAY, 4);
    const thresholdMat = new cv.Mat();
    cv.adaptiveThreshold(grayscaleMat, thresholdMat, 200, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 999, 2);
    const dstMat = new cv.Mat();
    cv.cvtColor(thresholdMat, dstMat, cv.COLOR_GRAY2RGBA, 4);
    try {
      cv.addWeighted(currentMat, 1.0, dstMat, lightValue, 0, dstMat);
      cv.imshow(canvasRef.current, dstMat);
      setCurrentMat(dstMat);
    } catch (error) {
      console.error("Failed to display image on canvas:", error);
    } finally {
      grayscaleMat.delete();
      thresholdMat.delete();
    }
    setLight(lightValue);
  };

  const filters = [
    { onClick: handleAESHE, title: "Balanced Contrast", description: "Adaptive enhancement for clearer midtones and structure.", imageSrc: "/img/sample.png", accent: "amber" },
    { onClick: handleCLAHE, title: "Local Contrast", description: "Bring out detail without flattening the full image.", imageSrc: "/img/sample.png", accent: "slate" },
    { onClick: handleWinter, title: "Winter Wash", description: "Cool shadows and crisp tones for a brighter, icy mood.", imageSrc: "/img/winter.webp", accent: "blue" },
    { onClick: handleSummmer, title: "Summer Glow", description: "Warmer highlights and richer sunlit skin and scenery.", imageSrc: "/img/summer.webp", accent: "coral" },
    { onClick: handleColorMix, title: "Color Mix", description: "Borrow palette cues from the sample artwork.", imageSrc: "/img/target_image.jpg", id: "img", accent: "olive" },
  ];

  const sliderColor = [
    { min: 0.8, max: 1.2, step: 0.01, title: "Saturation", initialData: 1, backgroundType: "greenToPurple", onValueChange: handleColorSaturation },
    { min: -20, max: 20, step: 0.5, title: "Temperature", initialData: 0, backgroundType: "blueToYellow", onValueChange: handleTempature },
  ];

  const sliderLight = [
    { min: -50, max: 50, step: 5, title: "Brightness", initialData: 0, onValueChange: handleBrightness },
    { min: -125, max: 125, step: 5, title: "Contrast", initialData: 0, onValueChange: handleContrast },
    { min: -0.5, max: 0.5, step: 0.01, title: "Shadow", initialData: 0, onValueChange: handleShadow },
    { min: -0.5, max: 0.5, step: 0.01, title: "Highlight", initialData: 0, onValueChange: handleLight },
  ];

  const stats = [
    { label: "Filters", value: filters.length },
    { label: "Variants", value: imageList.length },
    { label: "Canvas", value: src ? "Live" : "Idle" },
  ];

  const blackHandleLeft = `${(levelsRange.black / 255) * 100}%`;
  const whiteHandleLeft = `${(levelsRange.white / 255) * 100}%`;

  return (
    <div className="editor-shell">
      <Header />
      <main className="editor-main">
        <section className="workspace-grid">
          <div className="canvas-column">
            <div className="surface-panel surface-panel-hero">
              <div className="surface-panel-head">
                <div>
                  <p className="eyebrow">Canvas</p>
                  <h2>Build a clean edit flow around one image at a time</h2>
                </div>
                <div className="status-pill">
                  <span className={`status-dot ${src ? "ready" : ""}`} />
                  {src ? "Image loaded" : "Awaiting upload"}
                </div>
              </div>
              <div className="stats-row">
                {stats.map((item) => (
                  <div className="stat-chip" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <div className="canvas-stage">
                <div className="canvas-stage-frame">
                  {src ? (
                    <canvas ref={canvasRef} className="editor-canvas" />
                  ) : (
                    <div className="canvas-empty-state">
                      {histogramReady && (
                        <ImageUploader imageSrc={src} setImageSrc={setSrc} setImageList={setImageList}>
                          <p className="upload-title">Drop an image to begin</p>
                          <p className="upload-copy">Start with JPG, PNG, GIF, or SVG and we will build the edit stack around it.</p>
                        </ImageUploader>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="canvas-toolbar">
                <IconButton label="Refresh" description="Reload the current source frame" onClick={refresh}><RefreshIcon /></IconButton>
                <IconButton label="Reset" description="Return to the original uploaded state" onClick={handleReset}><ResetIcon /></IconButton>
                <IconButton label="Export" description="Save the current canvas as PNG" onClick={handleExport}><ExportIcon /></IconButton>
              </div>
            </div>
            <div className="surface-panel">
              <div className="surface-panel-head compact">
                <div>
                  <p className="eyebrow">Histogram</p>
                  <h3>Tonal distribution</h3>
                </div>
                <div className="levels-readout">
                  <span>Black {levelsRange.black}</span>
                  <span>White {levelsRange.white}</span>
                </div>
              </div>
              <div className="histogram-frame histogram-frame-interactive">
                <canvas
                  ref={histCanvas}
                  className="histogram-canvas"
                />
                <div className="histogram-overlay" aria-hidden="true">
                  <div
                    className="histogram-guide-line black-guide"
                    style={{ left: blackHandleLeft }}
                  />
                  <div
                    className="histogram-guide-label"
                    style={{ left: blackHandleLeft }}
                  >
                    B
                  </div>
                  <div
                    className="histogram-guide-line white-guide"
                    style={{ left: whiteHandleLeft }}
                  />
                  <div
                    className="histogram-guide-label"
                    style={{ left: whiteHandleLeft }}
                  >
                    W
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(levelsRange.white - 1, 0)}
                  value={levelsRange.black}
                  className="histogram-slider histogram-slider-black"
                  onChange={(event) =>
                    updateLevels(Number(event.target.value), levelsRange.white)
                  }
                  aria-label="Adjust black point"
                />
                <input
                  type="range"
                  min={Math.min(levelsRange.black + 1, 255)}
                  max="255"
                  value={levelsRange.white}
                  className="histogram-slider histogram-slider-white"
                  onChange={(event) =>
                    updateLevels(levelsRange.black, Number(event.target.value))
                  }
                  aria-label="Adjust white point"
                />
              </div>
              <p className="histogram-hint">Drag the B and W markers to set black and white points.</p>
            </div>
          </div>
          <aside className="control-column">
            <div className="surface-panel">
              <div className="surface-panel-head compact">
                <div>
                  <p className="eyebrow">Control Deck</p>
                  <h3>Looks and tonal adjustments</h3>
                </div>
              </div>
              <div className="control-stack">
                <Collapse title="Filters" description="Apply a quick creative starting point." defaultOpen>
                  <div className="card-grid">
                    {filters.map((item, index) => (
                      <CardButton onClick={item.onClick} key={index}>
                        <Card imageSrc={item.imageSrc} title={item.title} description={item.description} id={item.id} accent={item.accent} />
                      </CardButton>
                    ))}
                  </div>
                </Collapse>
                <Collapse title="Color" description="Shift hue energy and warmth with subtle control." defaultOpen>
                  <div className="slider-stack">
                    {sliderColor.map((slider, index) => (
                      <SlideBar key={index} min={slider.min} max={slider.max} step={slider.step} initialData={slider.initialData} title={slider.title} onValueChange={slider.onValueChange} backgroundType={slider.backgroundType} />
                    ))}
                  </div>
                </Collapse>
                <Collapse title="Lighting" description="Shape contrast and perceived depth." defaultOpen>
                  <div className="slider-stack">
                    {sliderLight.map((slider, index) => (
                      <SlideBar key={index} min={slider.min} max={slider.max} step={slider.step} initialData={slider.initialData} title={slider.title} onValueChange={slider.onValueChange} />
                    ))}
                  </div>
                </Collapse>
              </div>
            </div>
          </aside>
        </section>
        <section className="surface-panel filmstrip-panel">
          <div className="surface-panel-head compact">
            <div>
              <p className="eyebrow">Library</p>
              <h3>Recent image variants</h3>
            </div>
            <span className="surface-caption">Click any thumbnail to bring it back onto the canvas.</span>
          </div>
          <div className="filmstrip-row">
            {imageList.map((image, index) => (
              <button key={index} className="thumb-card" onClick={() => handleImageChange(image)}>
                <img src={image} alt="image preview" className="thumb-image" />
                <span className="thumb-label">Variant {index + 1}</span>
              </button>
            ))}
            <div className="thumb-card thumb-card-upload">
              {histogramReady && (
                <ImageUploader imageSrc={null} setImageSrc={setSrc} setImageList={setImageList}>
                  <p className="upload-title small">Add another image</p>
                  <p className="upload-copy small">Keep building your strip.</p>
                </ImageUploader>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
