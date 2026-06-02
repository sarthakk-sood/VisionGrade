import StatusBadge from '../common/StatusBadge';

export default function LowConfidenceFlag({ confidence }) {
  if (confidence >= 90) {
    return <StatusBadge tone="success">High confidence</StatusBadge>;
  }
  if (confidence >= 70) {
    return <StatusBadge tone="warning">Needs review</StatusBadge>;
  }
  return <StatusBadge tone="danger">Flagged low confidence</StatusBadge>;
}
