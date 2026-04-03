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
const BASE_COLOR_TEMPERATURE = 6500;
const MIN_COLOR_TEMPERATURE = 4500;
const MAX_COLOR_TEMPERATURE = 8500;
const DEFAULT_IMAGES = Object.values(
  import.meta.glob("../public/demo/*.{png,jpg,jpeg,webp,avif}", {
    eager: true,
    query: "?url",
    import: "default",
  }),
).sort();

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

function CompareIcon() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 5h7v14H4V5Zm9 0h7v14h-7V5Z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 14 4 9m0 0 5-5M4 9h9a7 7 0 1 1 0 14h-1" />
    </svg>
  );
}

export default function App() {
  const [src, setSrc] = useState(null);
  const [baseMat, setBaseMat] = useState(null);
  const [currentMat, setCurrentMat] = useState(null);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [shadow, setShadow] = useState(0);
  const [light, setLight] = useState(0);
  const [tempature, setTempature] = useState(BASE_COLOR_TEMPERATURE);
  const [imageList, setImageList] = useState(DEFAULT_IMAGES);
  const [histogramReady, setHistogramReady] = useState(false);
  const [levelsRange, setLevelsRange] = useState({ black: 0, white: 255 });
  const [editedPreviewUrl, setEditedPreviewUrl] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [historyStack, setHistoryStack] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
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

  const replaceBaseMat = (nextMat) => {
    setBaseMat((previousMat) => {
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

  const buildAdjustmentState = (overrides = {}) => ({
    brightness: overrides.brightness ?? brightness,
    contrast: overrides.contrast ?? contrast,
    saturation: overrides.saturation ?? saturation,
    shadow: overrides.shadow ?? shadow,
    light: overrides.light ?? light,
    tempature: overrides.tempature ?? tempature,
    levelsRange: overrides.levelsRange ?? { ...levelsRange },
  });

  const applyAdjustmentState = (state) => {
    if (!state) return;
    setBrightness(state.brightness ?? 0);
    setContrast(state.contrast ?? 0);
    setSaturation(state.saturation ?? 1);
    setShadow(state.shadow ?? 0);
    setLight(state.light ?? 0);
    setTempature(state.tempature ?? BASE_COLOR_TEMPERATURE);
    if (state.levelsRange) {
      setLevelsRange({
        black: state.levelsRange.black ?? 0,
        white: state.levelsRange.white ?? 255,
      });
    }
  };

  const commitMat = (nextMat, { pushHistory = true, syncLevels = true, adjustmentState = null } = {}) => {
    if (!nextMat || nextMat.empty()) return;

    const committedMat = nextMat.clone();
    replaceBaseMat(committedMat);
    replaceCurrentMat(nextMat);

    if (syncLevels) {
      resetLevels();
    }

    syncCanvasSnapshot(pushHistory, adjustmentState);
  };

  const loadImageToCanvas = (image, onLoad) => {
    if (!canvasRef.current || !image) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      onLoad?.(canvas, img);
    };

    img.src = image;
  };

  const createMatFromImageData = (imageData) => {
    if (cv.matFromImageData) {
      return cv.matFromImageData(imageData);
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCanvas.getContext("2d").putImageData(imageData, 0, 0);
    return cv.imread(tempCanvas);
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

  const syncCanvasSnapshot = (pushHistory = true, adjustmentState = null) => {
    if (!canvasRef.current || !canvasRef.current.width || !canvasRef.current.height) return;

    const snapshot = canvasRef.current.toDataURL("image/png");
    setEditedPreviewUrl(snapshot);

    if (!pushHistory) return;

    setHistoryStack((previousHistory) => {
      const truncatedHistory =
        historyIndex >= 0 ? previousHistory.slice(0, historyIndex + 1) : previousHistory;

      const previousEntry = truncatedHistory[truncatedHistory.length - 1];
      if (previousEntry?.snapshot === snapshot) {
        return truncatedHistory;
      }

      const nextHistory = [
        ...truncatedHistory,
        {
          snapshot,
          adjustments: adjustmentState ?? buildAdjustmentState(),
        },
      ];
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
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
    cv.onRuntimeInitialized = () => {
      replaceBaseMat(new cv.Mat());
      replaceCurrentMat(new cv.Mat());
    };
  }, []);

  useEffect(() => {
    setImageList(DEFAULT_IMAGES);
  }, []);

  useEffect(() => {
    if (!src) {
      drawDefaultBackground(() => setHistogramReady(true));
      return;
    }
    loadImageToCanvas(src, (canvas) => {
      resetLevels();
      const mat = cv.imread(canvas);
      commitMat(mat, { pushHistory: false });
      const snapshot = canvas.toDataURL("image/png");
      setEditedPreviewUrl(snapshot);
      setHistoryStack([
        {
          snapshot,
          adjustments: buildAdjustmentState(),
        },
      ]);
      setHistoryIndex(0);
    });
  }, [src]);

  useEffect(() => {
    if (hasRenderableImage()) drawHistGram();
  }, [currentMat]);

  const redrawImage = (image) => {
    loadImageToCanvas(image, (canvas) => {
      resetLevels();
      const mat = cv.imread(canvas);
      commitMat(mat, { pushHistory: false });
    });
  };

  const loadMatFromImage = (image) =>
    new Promise((resolve, reject) => {
      if (!canvasRef.current || !image) {
        reject(new Error("No source image available."));
        return;
      }

      const img = new Image();

      img.onload = () => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCanvas.getContext("2d").drawImage(img, 0, 0);
        resolve(cv.imread(tempCanvas));
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
    setBrightness(0);
    setContrast(0);
    setSaturation(1);
    setShadow(0);
    setLight(0);
    setTempature(BASE_COLOR_TEMPERATURE);
    setCompareMode(false);
    refresh();
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;

    const previousIndex = historyIndex - 1;
    const previousEntry = historyStack[previousIndex];
    if (!previousEntry?.snapshot) return;

    setHistoryIndex(previousIndex);
    setEditedPreviewUrl(previousEntry.snapshot);
    applyAdjustmentState(previousEntry.adjustments);
    redrawImage(previousEntry.snapshot);
  };

  const handleExport = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "everyday-edit-export.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const renderCompareFrame = (showOriginal) => {
    if (!canvasRef.current || !src) return;

    if (showOriginal) {
      loadImageToCanvas(src, () => {});
      return;
    }

    if (currentMat && !currentMat.empty()) {
      cv.imshow(canvasRef.current, currentMat);
    }
  };

  const applyAndRender = (nextMat, adjustmentState = null) => {
    if (!canvasRef.current || !nextMat || nextMat.empty()) return;
    try {
      cv.imshow(canvasRef.current, nextMat);
      commitMat(nextMat, { adjustmentState });
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
      const mat = createMatFromImageData(adjusted);
      commitMat(mat, {
        pushHistory: false,
        syncLevels: false,
        adjustmentState: buildAdjustmentState({
          levelsRange: { black, white },
        }),
      });
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
    if (!baseMat || baseMat.empty()) return;
    const kelvinDelta = (tempatureValue - tempature) / 100;
    const dst = filter.adjustColorTemperature(baseMat, kelvinDelta);
    setTempature(tempatureValue);
    applyAndRender(dst, buildAdjustmentState({ tempature: tempatureValue }));
  };

  const handleBrightness = (newBrightness) => {
    if (!baseMat || baseMat.empty()) return;
    const dstMat = new cv.Mat();
    baseMat.convertTo(dstMat, -1, 1, newBrightness - brightness);
    if (dstMat.empty()) return;
    setBrightness(newBrightness);
    applyAndRender(dstMat, buildAdjustmentState({ brightness: newBrightness }));
  };

  const handleContrast = (contrastValue) => {
    if (!baseMat || baseMat.empty()) return;
    const dst = new cv.Mat();
    const normalized = contrastValue / 255.0;
    const k = Math.tan(((45 + 44 * normalized) * Math.PI) / 180);
    baseMat.convertTo(dst, cv.CV_8U, k, 127.5 * -k + 127.5);
    setContrast(contrastValue);
    applyAndRender(dst, buildAdjustmentState({ contrast: contrastValue }));
  };

  const handleColorSaturation = (saturationValue) => {
    if (!baseMat || baseMat.empty()) return;
    const canvas = canvasRef.current;
    const hsvMat = new cv.Mat();
    cv.cvtColor(baseMat, hsvMat, cv.COLOR_RGB2HSV, 4);
    const lutWeaken = new cv.Mat(256, 1, cv.CV_8UC1);
    for (let i = 0; i < 256; i += 1) {
      lutWeaken.data[i] = Math.max(Math.min(255, i * saturationValue), 0);
    }
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
      commitMat(dst, {
        adjustmentState: buildAdjustmentState({ saturation: saturationValue }),
      });
    } catch (error) {
      console.error("Failed to display image on canvas:", error);
      dst.delete();
    }
    hsvMat.delete();
    lutWeaken.delete();
    channels.delete();
    tmp.delete();
    setSaturation(saturationValue);
  };

  const handleShadow = (shadowValue) => {
    if (!baseMat || baseMat.empty()) return;
    const grayscaleMat = new cv.Mat();
    cv.cvtColor(baseMat, grayscaleMat, cv.COLOR_RGBA2GRAY, 4);
    const thresholdMat = new cv.Mat();
    cv.adaptiveThreshold(grayscaleMat, thresholdMat, 200, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 999, 2);
    const dstMat = new cv.Mat();
    cv.cvtColor(thresholdMat, dstMat, cv.COLOR_GRAY2RGBA, 4);
    try {
      cv.addWeighted(baseMat, 1.0, dstMat, shadowValue, 0, dstMat);
      cv.imshow(canvasRef.current, dstMat);
      commitMat(dstMat, {
        adjustmentState: buildAdjustmentState({ shadow: shadowValue }),
      });
    } catch (error) {
      console.error("Failed to display image on canvas:", error);
      dstMat.delete();
    } finally {
      grayscaleMat.delete();
      thresholdMat.delete();
    }
    setShadow(shadowValue);
  };

  const handleLight = (lightValue) => {
    if (!baseMat || baseMat.empty()) return;
    const grayscaleMat = new cv.Mat();
    cv.cvtColor(baseMat, grayscaleMat, cv.COLOR_RGBA2GRAY, 4);
    const thresholdMat = new cv.Mat();
    cv.adaptiveThreshold(grayscaleMat, thresholdMat, 200, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 999, 2);
    const dstMat = new cv.Mat();
    cv.cvtColor(thresholdMat, dstMat, cv.COLOR_GRAY2RGBA, 4);
    try {
      cv.addWeighted(baseMat, 1.0, dstMat, lightValue, 0, dstMat);
      cv.imshow(canvasRef.current, dstMat);
      commitMat(dstMat, {
        adjustmentState: buildAdjustmentState({ light: lightValue }),
      });
    } catch (error) {
      console.error("Failed to display image on canvas:", error);
      dstMat.delete();
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
    { min: 0.8, max: 1.2, step: 0.01, title: "Saturation", initialData: saturation, backgroundType: "greenToPurple", onValueChange: handleColorSaturation, commitOnRelease: true },
    { min: MIN_COLOR_TEMPERATURE, max: MAX_COLOR_TEMPERATURE, step: 100, title: "Temperature", initialData: tempature, backgroundType: "blueToYellow", onValueChange: handleTempature, commitOnRelease: true, formatValue: (value) => `${Math.round(value)} K` },
  ];

  const sliderLight = [
    { min: -50, max: 50, step: 5, title: "Brightness", initialData: brightness, onValueChange: handleBrightness, commitOnRelease: true },
    { min: -125, max: 125, step: 5, title: "Contrast", initialData: contrast, onValueChange: handleContrast, commitOnRelease: true },
    { min: -0.5, max: 0.5, step: 0.01, title: "Shadow", initialData: shadow, onValueChange: handleShadow, commitOnRelease: true },
    { min: -0.5, max: 0.5, step: 0.01, title: "Highlight", initialData: light, onValueChange: handleLight, commitOnRelease: true },
  ];

  const stats = [
    { label: "Filters", value: filters.length },
    { label: "History", value: Math.max(historyIndex + 1, 0) },
    { label: "Canvas", value: src ? "Live" : "Idle" },
  ];

  const blackHandleLeft = `${(levelsRange.black / 255) * 100}%`;
  const whiteHandleLeft = `${(levelsRange.white / 255) * 100}%`;

  useEffect(() => {
    if (!src || !canvasRef.current || !currentMat) return;
    renderCompareFrame(compareMode);
  }, [compareMode, src, currentMat]);

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
                <IconButton label="Compare" description="Toggle before and after view" onClick={() => setCompareMode((value) => !value)}><CompareIcon /></IconButton>
                <IconButton label="Undo" description="Step back through edit history" onClick={handleUndo}><UndoIcon /></IconButton>
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
                      <SlideBar key={index} min={slider.min} max={slider.max} step={slider.step} initialData={slider.initialData} title={slider.title} onValueChange={slider.onValueChange} backgroundType={slider.backgroundType} commitOnRelease={slider.commitOnRelease} formatValue={slider.formatValue} />
                    ))}
                  </div>
                </Collapse>
                <Collapse title="Lighting" description="Shape contrast and perceived depth." defaultOpen>
                  <div className="slider-stack">
                    {sliderLight.map((slider, index) => (
                      <SlideBar key={index} min={slider.min} max={slider.max} step={slider.step} initialData={slider.initialData} title={slider.title} onValueChange={slider.onValueChange} commitOnRelease={slider.commitOnRelease} />
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
