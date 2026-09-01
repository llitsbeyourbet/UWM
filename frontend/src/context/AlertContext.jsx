import React, { createContext, useContext, useState, useCallback } from 'react';
import AlertModal from '../../components/AlertModal';

const AlertContext = createContext();

export const AlertProvider = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState({
    isVisible: false,
    type: 'info', // success, error, warning, info, confirm
    title: '',
    message: '',
    confirmText: 'ตกลง',
    cancelText: 'ยกเลิก',
    onConfirm: null,
    onCancel: null,
  });

  const showAlert = useCallback((options) => {
    return new Promise((resolve) => {
      const { type = 'info', title, message, confirmText = 'ปิด' } = options;

      setAlertConfig({
        isVisible: true,
        type,
        title: title || (type === 'success' ? 'สำเร็จ!' : type === 'error' ? 'เกิดข้อผิดพลาด' : type === 'warning' ? 'คำเตือน' : 'แจ้งเตือน'),
        message,
        confirmText,
        onConfirm: () => {
          hideAlert();
          resolve();
        },
        onCancel: null,
      });
    });
  }, []);

  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setAlertConfig({
        isVisible: true,
        type: 'confirm',
        title: options.title || 'ยืนยันการทำรายการ',
        message: options.message,
        confirmText: options.confirmText || 'ตกลง',
        cancelText: options.cancelText || 'ยกเลิก',
        onConfirm: () => {
          hideAlert();
          resolve(true);
        },
        onCancel: () => {
          hideAlert();
          resolve(false);
        },
      });
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, isVisible: false }));
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, hideAlert }}>
      {children}
      {alertConfig.isVisible && (
        <AlertModal
          config={alertConfig}
          onClose={hideAlert}
        />
      )}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
