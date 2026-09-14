// Shared field definitions used by the extraction worker, review routes, and result display.
// Each entry maps to a DocVQA question sent to the docai-service.
const FIELDS = [
  {
    name: 'applicantName',
    label: 'Applicant Name',
    question: 'What is the applicant full name?',
  },
  {
    name: 'requestType',
    label: 'Request Type',
    question: 'What is the request type label or category written on this form? Answer with one word only: loan, refund, or account.',
  },
  {
    name: 'amount',
    label: 'Amount',
    question: 'What is the dollar amount requested or involved in this form?',
  },
  {
    name: 'requestDate',
    label: 'Request Date',
    question: 'What is the request or submission date on this form?',
  },
  {
    name: 'description',
    label: 'Description',
    question: 'What is the description, purpose, or reason stated on this form?',
  },
];

module.exports = { FIELDS };
