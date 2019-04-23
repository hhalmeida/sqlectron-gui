import React from 'react';
import PropTypes from 'proptypes';
import { requireLogos } from './require-context';
var { sqlectron } = window.myremote;
//var e=require('electron');
// console.log(sqlectron);

//var { sqlectron }= require('electron').remote;
/**
 * Load icons for supported database clients
 */
const ICONS = sqlectron.db.CLIENTS.reduce((clients, dbClient) => {
  /* eslint no-param-reassign:0 */
  clients[dbClient.key] = requireLogos(dbClient.key);
  // console.log(clients[dbClient.key]);
  return clients;
}, {});

const ServerListItem = ({ server, onConnectClick, onEditClick }) => (
  <div className="card">
    <div className="content">
      <div
        className="left floated"
        style={{ height: '35px', width: '35px', margin: '5px 10px 0 0' }}
      >
        <img
          alt="client"
          className="ui image"
          style={{ width: '100%' }}
          src={ICONS[server.client]}
        />
      </div>
      <button
        className="right floated circular ui icon button mini"
        onClick={() => onEditClick(server)}
      >
        <i className="icon pencil" />
      </button>
      <div className="header">{server.name}</div>
      <div
        className="meta"
        style={{ lineHeight: '1.5em', marginTop: '5px', marginLeft: '45px' }}
      >
        {server.host ? `${server.host}:${server.port}` : server.socketPath}
        {server.ssh && <div>via {server.ssh.host}</div>}
      </div>
    </div>
    <div
      className="ui bottom attached button"
      tabIndex="0"
      onClick={() => onConnectClick(server)}
    >
      <i className="plug icon" />
      Connect
    </div>
  </div>
);

ServerListItem.propTypes = {
  server: PropTypes.object.isRequired,
  onConnectClick: PropTypes.func.isRequired,
  onEditClick: PropTypes.func.isRequired,
};

export default ServerListItem;
