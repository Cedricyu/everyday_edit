import React from "react";

function ImageUploader({ children, imageSrc, setImageSrc, setImageList }) {
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        setImageSrc(loadEvent.target.result);
        setImageList((prevList) => [...prevList, loadEvent.target.result]);
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please select an image file.");
    }
  };

  return (
    <div className="upload-shell">
      {!imageSrc && (
        <label htmlFor="dropzone-file" className="upload-dropzone">
          <div className="upload-content">
            <div className="upload-icon">
              <svg aria-hidden="true" fill="none" viewBox="0 0 20 16">
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                />
              </svg>
            </div>
            {children}
          </div>
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            onChange={handleImageChange}
            accept="image/*"
          />
        </label>
      )}
    </div>
  );
}

export default ImageUploader;
