/* eslint-disable prettier/prettier */
const events = Object.freeze({
  JOIN_ROOM_MESSAGE: 'JOIN_ROOM_MESSAGE',
  NOTARY_AVAILABLE: 'NOTARY_AVAILABLE',
  NOTARY_SEND_TOOLS: 'NOTARY_SEND_TOOLS',
  NOTARY_NEW_REQUEST: 'NOTARY_NEW_REQUEST',
  NOTARY_ACCEPT_REQUEST: 'NOTARY_ACCEPT_REQUEST',
  NOTARY_REJECT_REQUEST: 'NOTARY_REJECT_REQUEST',
  NOTARY_CANCEL_REQUEST: 'NOTARY_CANCEL_REQUEST',
  NOTARY_EDIT_TOOLS: 'NOTARY_EDIT_TOOLS',
  NOTARY_DELETE_TOOLS: 'NOTARY_DELETE_TOOLS',
  NOTARY_COMPLETE_SESSION: 'NOTARY_COMPLETE_SESSION',
  NOTARY_CANCEL_SESSION: 'NOTARY_CANCEL_SESSION',
  DOC_OWNER_INVITE_PARTICIPANTS: 'DOC_OWNER_INVITE_PARTICIPANTS',
  REMOVE: 'REMOVE',
});
module.exports = events;
