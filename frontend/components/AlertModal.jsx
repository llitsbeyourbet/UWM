import React from 'react';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaInfoCircle, FaQuestionCircle } from 'react-icons/fa';
import '../styles/AlertModal.css';

const AlertModal = ({ config, onClose }) => {
  const { type, title, message, confirmText, cancelText, onConfirm, onCancel } = config;

  const getIcon = () => {
    switch (type) {
      case 'success': return <FaCheckCircle className="alert-icon success" />;
      case 'error': return <FaTimesCircle className="alert-icon error" />;
      case 'warning': return <FaExclamationTriangle className="alert-icon warning" />;
      case 'info': return <FaInfoCircle className="alert-icon info" />;
      case 'confirm': return <FaQuestionCircle className="alert-icon confirm" />;
      default: return <FaInfoCircle className="alert-icon info" />;
    }
  };

  return (
    <div className="alert-overlay">
      <div className="alert-modal">
        <div className="alert-modal-content">
          <div className="alert-modal-icon">
            {getIcon()}
          </div>
          <h2 className="alert-modal-title">{title}</h2>
          <p className="alert-modal-message">{message}</p>
          <div className="alert-modal-actions">
            {type === 'confirm' && cancelText && (
              <button className="alert-btn alert-btn-cancel" onClick={onCancel}>
                {cancelText}
              </button>
            )}
            <button className={`alert-btn alert-btn-confirm ${type}`} onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
