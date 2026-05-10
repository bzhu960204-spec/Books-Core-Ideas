import Modal from './Modal';

export default function ConfirmDialog({ message, onConfirm, onClose }) {
  return (
    <Modal title="Confirm" onClose={onClose}>
      <p className="confirm-text">{message}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
      </div>
    </Modal>
  );
}
