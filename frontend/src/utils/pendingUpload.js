let pendingFile = null;

export const setPendingFile = (f) => {
  pendingFile = f;
};
export const getPendingFile = () => pendingFile;
export const clearPendingFile = () => {
  pendingFile = null;
};
