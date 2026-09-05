import React, { useRef, useState } from 'react';

export default function FileUploadZone({ files, setFiles, error, setError }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFiles = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setError(null);

    const newFiles = [...files];
    const maxFiles = 10;
    const maxBytes = 10 * 1024 * 1024; // 10MB

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

      if (ext !== '.c' && ext !== '.pdf') {
        setError(`File "${file.name}" has invalid extension "${ext}". Only .c and .pdf files are allowed.`);
        return;
      }

      if (file.size > maxBytes) {
        setError(`File "${file.name}" exceeds 10MB limit.`);
        return;
      }

      if (newFiles.some((f) => f.name.toLowerCase() === file.name.toLowerCase())) {
        setError(`File "${file.name}" is already in your upload list.`);
        return;
      }

      if (newFiles.length >= maxFiles) {
        setError(`Maximum limit of ${maxFiles} files per submission reached.`);
        return;
      }

      newFiles.push(file);
    }

    setFiles(newFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
  };

  return (
    <div>
      <div
        className={`dropzone-container ${isDragging ? 'active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".c,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="dropzone-icon">📁</div>
        <div className="dropzone-title">Click to browse or drag and drop files here</div>
        <div className="dropzone-subtitle">
          Upload one or more C-program (.c) source files and assignment PDF (.pdf) reports
        </div>
        <div className="dropzone-tags">
          <span className="file-tag c">.C Source Code</span>
          <span className="file-tag pdf">.PDF Report</span>
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, idx) => {
            const isC = file.name.toLowerCase().endsWith('.c');
            return (
              <div key={idx} className="file-item">
                <div className="file-item-left">
                  <span className={`file-badge ${isC ? 'c' : 'pdf'}`}>
                    {isC ? '.C' : 'PDF'}
                  </span>
                  <span className="file-name" title={file.name}>{file.name}</span>
                  <span className="file-size">({formatFileSize(file.size)})</span>
                </div>
                <button
                  type="button"
                  className="btn-remove-file"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
