import debounce from 'lodash.debounce';
import union from 'lodash.union';
import React, { Component } from 'react';
import PropTypes from 'proptypes';
import ReactDOM from 'react-dom';
import { withRouter } from 'react-router-dom';
import { connect } from 'react-redux';
import { ResizableBox } from 'react-resizable';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import * as ConnActions from '../actions/connections.js';
import * as QueryActions from '../actions/queries';
import * as DbAction from '../actions/databases';
import * as EditActions from '../reducers/tableEdit';
import { fetchTablesIfNeeded, selectTablesForDiagram } from '../actions/tables';
import { fetchSchemasIfNeeded } from '../actions/schemas';
import { fetchTableColumnsIfNeeded } from '../actions/columns';
import { fetchTableTriggersIfNeeded } from '../actions/triggers';
import { fetchTableIndexesIfNeeded } from '../actions/indexes';
import { fetchViewsIfNeeded } from '../actions/views';
import { fetchRoutinesIfNeeded } from '../actions/routines';
import { getSQLScriptIfNeeded } from '../actions/sqlscripts';
import { fetchTableKeysIfNeeded } from '../actions/keys';
//import DatabaseFilter from '../components/database-filter.jsx';
import DatabaseList from '../components/database-list.jsx';
import DatabaseDiagramModal from '../components/database-diagram-modal.jsx';
import Header from '../components/header.jsx';
import Footer from '../components/footer.jsx';
import Query from '../components/query.jsx';
import Loader from '../components/loader.jsx';
import PromptModal from '../components/prompt-modal.jsx';
import MenuHandler from '../menu-handler';
import { requireLogos } from '../components/require-context';
import ModalEdit from './ModalEdit';

//require('../components/react-resizable.css');
var { sqlectron } = window.myremote; //
const tab_title_h = '45px';
const SIDEBAR_WIDTH = 235;
const STYLES = {
  wrapper: {},
  container: {
    display: 'flex',
    boxSizing: 'border-box',
    padding: '50px 10px 40px 10px',
  },
  sidebar: {
    transition: 'all .2s',
  },
  content: { flex: 1, overflow: 'auto', paddingLeft: '5px' },
  collapse: {
    position: 'fixed',
    color: '#fff',
    cursor: 'pointer',
    width: 10,
    left: 0,
    height: '100vh',
    backgroundColor: 'rgb(102,102,102)',
    zIndex: 1,
    MozUserSelect: 'none',
    WebkitUserSelect: 'none',
    msUserSelect: 'none',
  },
  resizeable: { width: 'auto', maxWidth: '100%',minHeight:'100vh' },
};

const CLIENTS = sqlectron.db.CLIENTS.reduce((clients, dbClient) => {
  /* eslint no-param-reassign:0 */
  clients[dbClient.key] = {
    title: dbClient.name,
    image: requireLogos(dbClient.key),
  };
  return clients;
}, {});

class QueryBrowserContainer extends Component {
  static propTypes = {
    connections: PropTypes.object.isRequired,
    status: PropTypes.string.isRequired,
    databases: PropTypes.object.isRequired,
    schemas: PropTypes.object.isRequired,
    tables: PropTypes.object.isRequired,
    columns: PropTypes.object.isRequired,
    triggers: PropTypes.object.isRequired,
    indexes: PropTypes.object.isRequired,
    views: PropTypes.object.isRequired,
    routines: PropTypes.object.isRequired,
    queries: PropTypes.object.isRequired,
    sqlscripts: PropTypes.object.isRequired,
    keys: PropTypes.object.isRequired,
    tableEdit: PropTypes.object.isRequired,
    dispatch: PropTypes.func.isRequired,
    children: PropTypes.node,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      tabNavPosition: 0,
      sideBarWidth: SIDEBAR_WIDTH,
      sidebarCollapsed: false,
    };
    this.menuHandler = new MenuHandler();
  }

  componentWillMount() {
    // console.log(this.props);
    const { dispatch, match } = this.props;
    dispatch(ConnActions.connect(match.params.id));
  }

  componentDidMount() {
    this.setMenus();
  }

  componentWillReceiveProps(nextProps) {
    // console.log("componentWillReceiveProps");
    // console.log(nextProps);
    const { dispatch, history, connections } = nextProps;
    // console.log(connections);
    // if (
    //   connections.error ||
    //   (!connections.connecting &&
    //     !connections.server &&
    //     !connections.waitingSSHPassword)
    // ) {
    //   history.push('/');
    //   return;
    // }

    if (!connections.connected) {
      return;
    }

    const lastConnectedDB =
      connections.databases[connections.databases.length - 1];
    const filter = connections.server.filter;

    dispatch(DbAction.fetchDatabasesIfNeeded(filter));
    dispatch(fetchSchemasIfNeeded(lastConnectedDB));
    dispatch(fetchTablesIfNeeded(lastConnectedDB, filter));
    dispatch(fetchViewsIfNeeded(lastConnectedDB, filter));
    dispatch(fetchRoutinesIfNeeded(lastConnectedDB, filter));

    this.setMenus();
  }

  componentDidUpdate() {
    const elem = ReactDOM.findDOMNode(this.refs.tabList);
    if (!elem) {
      return;
    }

    this.tabListTotalWidth = elem.offsetWidth;
    this.tabListTotalWidthChildren = 0;
    for (const child of elem.children) {
      this.tabListTotalWidthChildren += child.offsetWidth;
    }
  }

  componentWillUnmount() {
    this.menuHandler.removeAllMenus();
  }

  onSelectDatabase(database) {
    const { dispatch, params } = this.props;

    dispatch(ConnActions.connect(params.id, database.name));
  }

  onExecuteDefaultQuery(database, table) {
    const schema = table.schema || this.props.connections.server.schema;
    this.props.dispatch(
      QueryActions.executeDefaultSelectQueryIfNeeded(
        database.name,
        table.name,
        schema
      )
    );
  }

  onCollapseClick = () => {
    this.setState({ sidebarCollapsed: !this.state.sidebarCollapsed });
  };

  onPromptCancelClick() {
    const { dispatch } = this.props;
    dispatch(ConnActions.disconnect());
  }

  onPromptOKClick(password) {
    const { dispatch, params } = this.props;
    dispatch(ConnActions.connect(params.id, null, false, password));
  }

  onSelectTable(database, table) {
    const schema = table.schema || this.props.connections.server.schema;
    this.props.dispatch(
      fetchTableColumnsIfNeeded(database.name, table.name, schema)
    );
    this.props.dispatch(
      fetchTableTriggersIfNeeded(database.name, table.name, schema)
    );
    this.props.dispatch(
      fetchTableIndexesIfNeeded(database.name, table.name, schema)
    );
  }

  onGetSQLScript(database, item, actionType, objectType) {
    const schema = item.schema || this.props.connections.server.schema;
    this.props.dispatch(
      getSQLScriptIfNeeded(
        database.name,
        item.name,
        actionType,
        objectType,
        schema
      )
    );
  }

  onSQLChange(sqlQuery) {
    this.props.dispatch(QueryActions.updateQueryIfNeeded(sqlQuery));
  }

  onQuerySelectionChange(sqlQuery, selectedQuery) {
    this.props.dispatch(
      QueryActions.updateQueryIfNeeded(sqlQuery, selectedQuery)
    );
  }

  onFilterChange(value) {
    this.setState({ filter: value });
  }

  onCloseConnectionClick() {
    const { dispatch } = this.props;
    dispatch(ConnActions.disconnect());
    this.props.history.push('/');
  }

  onReConnectionClick() {
    const { dispatch, params } = this.props;
    dispatch(ConnActions.reconnect(params.id, this.getCurrentQuery().database));
  }

  onRefreshDatabase(database) {
    const { dispatch } = this.props;
    dispatch(DbAction.refreshDatabase(database));
  }

  onShowDiagramModal(database) {
    const { dispatch } = this.props;
    dispatch(DbAction.showDatabaseDiagram(database.name));
  }

  onGenerateDatabaseDiagram(database, selectedTables) {
    const { dispatch } = this.props;
    //const selectedTables = [];

    dispatch(DbAction.generateDatabaseDiagram());
    //todo
    // $(':checkbox:checked', 'div.ui.list')
    //   .map((index, checkbox) => selectedTables.push(checkbox.id));

    dispatch(selectTablesForDiagram(selectedTables));
    this.fetchTableDiagramData(database, selectedTables);
  }

  onAddRelatedTables(relatedTables) {
    const { dispatch, databases, tables } = this.props;
    const database = databases.diagramDatabase;
    const tablesOnDiagram = tables.selectedTablesForDiagram;
    const selectedTables = union(tablesOnDiagram, relatedTables);

    dispatch(selectTablesForDiagram(selectedTables));
    this.fetchTableDiagramData(database, relatedTables);
  }

  onSaveDatabaseDiagram(diagram) {
    this.props.dispatch(DbAction.saveDatabaseDiagram(diagram));
  }

  onExportDatabaseDiagram(diagram, imageType) {
    this.props.dispatch(DbAction.exportDatabaseDiagram(diagram, imageType));
  }

  onOpenDatabaseDiagram() {
    this.props.dispatch(DbAction.openDatabaseDiagram());
  }

  onCloseDiagramModal() {
    this.props.dispatch(DbAction.closeDatabaseDiagram());
  }

  onTabDoubleClick(queryId) {
    this.setState({ renamingTabQueryId: queryId });
  }

  getCurrentQuery() {
    return this.props.queries.queriesById[this.props.queries.currentQueryId];
  }

  setMenus() {
    this.menuHandler.setMenus({
      'sqlectron:query-execute': () => {
        const {
          queries: { queriesById, currentQueryId },
        } = this.props;
        const currentQuery = queriesById[currentQueryId];
        this.handleExecuteQuery(
          currentQuery.selectedQuery || currentQuery.query
        );
      },
      'sqlectron:new-tab': () => this.newTab(),
      'sqlectron:close-tab': () => this.closeTab(),
      'sqlectron:save-query': () => this.saveQuery(),
      'sqlectron:open-query': () => this.openQuery(),
      'sqlectron:query-focus': () => this.focusQuery(),
      'sqlectron:toggle-database-search': () => this.toggleDatabaseSearch(),
      'sqlectron:toggle-database-objects-search': () =>
        this.toggleDatabaseObjectsSearch(),
    });
  }

  fetchTableDiagramData(database, tables) {
    const { dispatch, connections } = this.props;
    tables.forEach(item => {
      const schema = item.schema || connections.server.schema;
      dispatch(fetchTableColumnsIfNeeded(database, item, schema));
      dispatch(fetchTableKeysIfNeeded(database, item, schema));
    });
  }

  handleSelectTab(index) {
    const queryId = this.props.queries.queryIds[index];
    this.props.dispatch(QueryActions.selectQuery(queryId));
  }

  removeQuery(queryId) {
    this.props.dispatch(QueryActions.removeQuery(queryId));
  }

  saveQuery() {
    this.props.dispatch(QueryActions.saveQuery());
  }

  openQuery() {
    this.props.dispatch(QueryActions.openQuery());
  }

  copyToClipboard = (rows, type) => {
    //console.log(rows);
    //console.log(type);
    this.props.dispatch(QueryActions.copyToClipboard(rows, type));
  };

  saveToFile(rows, type) {
    this.props.dispatch(QueryActions.saveToFile(rows, type));
  }

  handleExecuteQuery(sqlQuery) {
    const currentQuery = this.getCurrentQuery();
    if (!currentQuery) {
      return;
    }

    this.props.dispatch(
      QueryActions.executeQueryIfNeeded(sqlQuery, currentQuery.id)
    );
  }

  handleCancelQuery() {
    const currentQuery = this.getCurrentQuery();
    if (!currentQuery) {
      return;
    }

    this.props.dispatch(QueryActions.cancelQuery(currentQuery.id));
  }

  filterDatabases(name, databases) {
    const regex = RegExp(name, 'i');
    // console.log("filterDatabases");
    // console.log(databases.length);

    return databases.filter(db => regex.test(db.name));
  }

  focusQuery() {
    const currentQuery = this.getCurrentQuery();
    if (!currentQuery) {
      return;
    }

    this.refs[`queryBox_${currentQuery.id}`].focus();
  }

  toggleDatabaseSearch() {
    this.refs.databaseFilter.focus();
  }

  toggleDatabaseObjectsSearch() {
    const currentDB = this.getCurrentQuery().database;
    if (!currentDB) {
      return;
    }

    this.refs.databaseList.focus(currentDB);
  }

  newTab() {
    this.props.dispatch(QueryActions.newQuery(this.getCurrentQuery().database));
  }
  onExecuteEditTable = (database, item) => {
    // console.log("onExecuteEditTable");
    this.props.dispatch({
      type: EditActions.SHOW_EDIT,
      database: database,
      item: item,
    });
  };
  closeTab() {
    this.removeQuery(this.props.queries.currentQueryId);
  }

  renderDatabaseDiagramModal() {
    const { databases, tables, columns, views, keys } = this.props;

    const selectedDB = databases.diagramDatabase;

    return (
      <DatabaseDiagramModal
        modalOpen={this.props.databases.showingDiagram}
        database={selectedDB}
        tables={tables.itemsByDatabase[selectedDB]}
        selectedTables={tables.selectedTablesForDiagram}
        views={views.viewsByDatabase[selectedDB]}
        columnsByTable={columns.columnsByTable[selectedDB]}
        tableKeys={keys.keysByTable[selectedDB]}
        diagramJSON={databases.diagramJSON}
        isSaving={databases.isSaving}
        onGenerateDatabaseDiagram={this.onGenerateDatabaseDiagram.bind(this)}
        addRelatedTables={this.onAddRelatedTables.bind(this)}
        onSaveDatabaseDiagram={this.onSaveDatabaseDiagram.bind(this)}
        onExportDatabaseDiagram={this.onExportDatabaseDiagram.bind(this)}
        onOpenDatabaseDiagram={this.onOpenDatabaseDiagram.bind(this)}
        onClose={this.onCloseDiagramModal.bind(this)}
      />
    );
  }

  renderTabQueries() {
    const {
      dispatch,
      connections,
      queries,
      databases,
      schemas,
      tables,
      columns,
      triggers,
      indexes,
      views,
      routines,
    } = this.props;

    const currentDB = this.getCurrentQuery().database;

    const menu = queries.queryIds.map(queryId => {
      //const isCurrentQuery = queryId === queries.currentQueryId;
      const buildContent = () => {
        const isRenaming = this.state.renamingTabQueryId === queryId;
        if (isRenaming) {
          return (
            <div className="ui input">
              <input
                autoFocus
                type="text"
                ref={comp => {
                  this.tabInput = comp;
                }}
                onBlur={() => {
                  dispatch(QueryActions.renameQuery(this.tabInput.value));
                  this.setState({ renamingTabQueryId: null });
                }}
                onKeyDown={event => {
                  if (event.key !== 'Escape' && event.key !== 'Enter') {
                    return;
                  }

                  if (event.key === 'Enter') {
                    dispatch(QueryActions.renameQuery(this.tabInput.value));
                  }

                  this.setState({ renamingTabQueryId: null });
                }}
                defaultValue={queries.queriesById[queryId].name}
              />
            </div>
          );
        }
        //return queries.queriesById[queryId].name;
        var names = queries.queriesById[queryId].name.split('/');
        var name = names[names.length - 1];
        return (
          <div style={{ display: 'flex', height: tab_title_h }}>
            {name}
            <i
              onClick={debounce(() => {
                this.removeQuery(queryId);
                const position = this.state.tabNavPosition + 200;
                this.setState({ tabNavPosition: position > 0 ? 0 : position });
              }, 200)}
              className="icon remove"
            />
          </div>
        );
      };

      return (
        <Tab key={queryId} onDoubleClick={() => this.onTabDoubleClick(queryId)}>
          {buildContent()}
        </Tab>
      );
    });

    const { disabledFeatures } = sqlectron.db.CLIENTS.find(
      dbClient => dbClient.key === connections.server.client
    );

    const allowCancel =
      !disabledFeatures || !~disabledFeatures.indexOf('cancelQuery');
    var offset;
    if (this.state.sidebarCollapsed) {
      offset = 0;
    } else {
      offset = this.state.sideBarWidth;
    }
    const panels = queries.queryIds.map(queryId => {
      const query = queries.queriesById[queryId];

      return (
        <TabPanel key={queryId}>
          <Query
            model={{ queryId: queryId, store: this.props }}
            ref={`queryBox_${queryId}`}
            editorName={`querybox${queryId}`}
            client={connections.server.client}
            allowCancel={allowCancel}
            query={query}
            enabledAutoComplete={queries.enabledAutoComplete}
            enabledLiveAutoComplete={queries.enabledLiveAutoComplete}
            database={currentDB}
            databases={databases.items}
            schemas={schemas.itemsByDatabase[query.database]}
            tables={tables.itemsByDatabase[query.database]}
            columnsByTable={columns.columnsByTable[query.database]}
            triggersByTable={triggers.triggersByTable[query.database]}
            indexesByTable={indexes.indexesByTable[query.database]}
            views={views.viewsByDatabase[query.database]}
            functions={routines.functionsByDatabase[query.database]}
            procedures={routines.proceduresByDatabase[query.database]}
            widthOffset={offset}
            onExecQueryClick={this.handleExecuteQuery.bind(this)}
            onCancelQueryClick={this.handleCancelQuery.bind(this)}
            onCopyToClipboardClick={this.copyToClipboard}
            onSaveToFileClick={this.saveToFile.bind(this)}
            onSQLChange={this.onSQLChange.bind(this)}
            onSelectionChange={this.onQuerySelectionChange.bind(this)}
          />
        </TabPanel>
      );
    });

    // const isOnMaxPosition = (
    //   this.tabListTotalWidthChildren - Math.abs(this.state.tabNavPosition) <= this.tabListTotalWidth
    // );
    const selectedIndex = queries.queryIds.indexOf(queries.currentQueryId);
    //const isTabsFitOnScreen = (this.tabListTotalWidthChildren >= this.tabListTotalWidth);
    return (
      <Tabs
        onSelect={this.handleSelectTab.bind(this)}
        selectedIndex={selectedIndex}
        forceRenderTabPanel
      >
        {
          // <div id="tabs-nav-wrapper" className="ui pointing secondary menu">
          //   {isTabsFitOnScreen &&
          //     <button className="ui icon button"
          //       disabled={this.state.tabNavPosition === 0}
          //       onClick={() => {
          //         const position = this.state.tabNavPosition + 100;
          //         this.setState({ tabNavPosition: position > 0 ? 0 : position });
          //       }}>
          //       <i className="left chevron icon"></i>
          //     </button>
          //   }
          //   <div style={{flex: "auto",overFlow: "hidden"}} >
        }
        <TabList
          ref="tabList"
          style={{
            display: 'flex',
            height: tab_title_h,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          {menu}
        </TabList>
        {
          //   </div>
          //   <button className="ui basic icon button" onClick={() => this.newTab()}>
          //     <i className="plus icon"></i>
          //   </button>
          //   {isTabsFitOnScreen &&
          //     <button className="ui icon button"
          //       disabled={this.tabListTotalWidthChildren < this.tabListTotalWidth || isOnMaxPosition}
          //       onClick={() => {
          //         const position = this.state.tabNavPosition - 100;
          //         this.setState({ tabNavPosition: position });
          //       }}>
          //       <i className="right chevron icon"></i>
          //     </button>
          //   }
          // </div>
        }
        {panels}
      </Tabs>
    );
  }

  render() {
    // console.log("render query-browser==========================");
    // console.log(this);
    const { filter } = this.state;
    const {
      status,
      connections,
      databases,
      schemas,
      tables,
      columns,
      triggers,
      indexes,
      views,
      routines,
    } = this.props;
    const currentDB = this.getCurrentQuery()
      ? this.getCurrentQuery().database
      : null;

    if (connections.waitingPrivateKeyPassphrase) {
      return (
        <PromptModal
          modalOpen={connections.waitingPrivateKeyPassphrase}
          type="password"
          title={'SSH Private Key Passphrase'}
          message="Enter the private key passphrase:"
          onCancelClick={this.onPromptCancelClick.bind(this)}
          onOKClick={this.onPromptOKClick.bind(this)}
        />
      );
    }

    const isLoading = !connections.connected;
    if (isLoading && (!connections.server || !this.getCurrentQuery())) {
      return <Loader message={status} type="page" />;
    }

    const breadcrumb = connections.server
      ? [
          { icon: 'server', label: connections.server.name },
          { icon: 'database', label: this.getCurrentQuery().database },
        ]
      : [];

    const filteredDatabases = this.filterDatabases(filter, databases.items);
    return (
      <div style={STYLES.wrapper}>
        {isLoading && <Loader message={status} type="page" />}
        {this.props.tableEdit.show_edit && (
          <ModalEdit
            modalOpen={this.props.tableEdit.show_edit}
            handleClose={() => {
              this.props.dispatch({ type: EditActions.HIDE_EDIT });
            }}
            database={this.props.tableEdit.database}
            item={this.props.tableEdit.item}
          />
        )}
        <div style={STYLES.header}>
          <Header
            items={breadcrumb}
            onCloseConnectionClick={this.onCloseConnectionClick.bind(this)}
            onReConnectionClick={this.onReConnectionClick.bind(this)}
          />
        </div>
        <div onClick={this.onCollapseClick} style={STYLES.collapse}>
          <i
            className={`${
              this.state.sidebarCollapsed ? 'right' : 'left'
            } triangle icon`}
            style={{
              top: 'calc(100vh/2 - 7px)',
              position: 'absolute',
              marginLeft: -3,
            }}
          />
        </div>
        <div style={STYLES.container}>
          <div
            id="sidebar"
            style={{
              ...STYLES.sidebar,
              marginLeft: this.state.sidebarCollapsed
                ? -this.state.sideBarWidth
                : 0,
            }}
          >
            <ResizableBox
              className="react-resizable react-resizable-ew-resize"
              onResizeStop={(event, { size }) =>
                this.setState({ sideBarWidth: size.width })
              }
              width={this.state.sideBarWidth || SIDEBAR_WIDTH}
              height={NaN}
              minConstraints={[SIDEBAR_WIDTH, 300]}
              maxConstraints={[750, 10000]}
            >
              <div className="ui vertical menu" style={STYLES.resizeable}>
                <div className="item active" style={{ textAlign: 'center' }}>
                  <b>{connections.server.name}</b>
                  <img
                    title={CLIENTS[connections.server.client].name}
                    alt={CLIENTS[connections.server.client].name}
                    style={{ width: '2.5em' }}
                    className="ui mini left spaced image right"
                    src={CLIENTS[connections.server.client].image}
                  />
                </div>
                {
                  // <div className="item">
                  //   <DatabaseFilter
                  //     ref="databaseFilter"
                  //     value={filter}
                  //     isFetching={databases.isFetching}
                  //     onFilterChange={this.onFilterChange.bind(this)} />
                  // </div>
                }
                <DatabaseList
                  ref="databaseList"
                  client={connections.server.client}
                  databases={filteredDatabases}
                  currentDB={currentDB}
                  isFetching={databases.isFetching}
                  schemasByDatabase={schemas.itemsByDatabase}
                  tablesByDatabase={tables.itemsByDatabase}
                  columnsByTable={columns.columnsByTable}
                  triggersByTable={triggers.triggersByTable}
                  indexesByTable={indexes.indexesByTable}
                  viewsByDatabase={views.viewsByDatabase}
                  functionsByDatabase={routines.functionsByDatabase}
                  proceduresByDatabase={routines.proceduresByDatabase}
                  onSelectDatabase={this.onSelectDatabase.bind(this)}
                  onExecuteDefaultQuery={this.onExecuteDefaultQuery.bind(this)}
                  onExecuteEditTable={this.onExecuteEditTable}
                  onSelectTable={this.onSelectTable.bind(this)}
                  onGetSQLScript={this.onGetSQLScript.bind(this)}
                  onRefreshDatabase={this.onRefreshDatabase.bind(this)}
                  onShowDiagramModal={this.onShowDiagramModal.bind(this)}
                />
              </div>
            </ResizableBox>
          </div>
          <div style={STYLES.content}>{this.renderTabQueries()}</div>
          {this.props.databases.showingDiagram &&
            this.renderDatabaseDiagramModal()}
        </div>
        {
          //<div style={STYLES.footer}>
          //  <Footer status={status} />
          //</div>
        }
        <style jsx="true">{`
          #sidebar {
            overflow-y: hidden;
            overflow-x: hidden;
          }
          #sidebar ::-webkit-scrollbar {
            display: none;
          }

          #sidebar:hover {
            overflow-y: auto;
            overflow-y: overlay;
          }
          #sidebar:hover ::-webkit-scrollbar {
            display: block;
          }

          #sidebar ::-webkit-scrollbar {
            -webkit-appearance: none;
          }
          #sidebar ::-webkit-scrollbar-thumb {
            box-shadow: inset 0 -2px, inset 0 -8px, inset 0 2px, inset 0 8px;
            min-height: 36px;
          }
        `}</style>
      </div>
    );
  }
}

function mapStateToProps(state) {
  // console.log("mapStateToProps");
  // console.log(state)
  const {
    connections,
    databases,
    schemas,
    tables,
    columns,
    triggers,
    indexes,
    views,
    routines,
    queries,
    sqlscripts,
    keys,
    status,
    tableEdit,
  } = state;

  return {
    connections,
    databases,
    schemas,
    tables,
    columns,
    triggers,
    indexes,
    views,
    routines,
    queries,
    sqlscripts,
    keys,
    status,
    tableEdit,
  };
}

export default connect(mapStateToProps)(withRouter(QueryBrowserContainer));
