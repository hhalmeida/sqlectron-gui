import React, { Component } from 'react';
import PropTypes from 'proptypes';

import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
export default class PromptModal extends Component {
  static propTypes = {
    onCancelClick: PropTypes.func.isRequired,
    onOKClick: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  };
  constructor() {
    super();
    this.state = { modalOpen: false };
  }

  componentDidMount() {
    // $(this.refs.promptModal).modal({
    //   closable: false,
    //   detachable: false,
    //   onDeny: () => {
    //     this.props.onCancelClick();
    //     return true;
    //   },
    //   onApprove: () => {
    //     this.props.onOKClick(this.state.value);
    //     return true;
    //   },
    // }).modal('show');
  }

  componentWillUnmount() {
    //$(this.refs.promptModal).modal('hide');
  }

  handleKeyPress(event) {
    if (event.key === 'Enter') {
      this.props.onOKClick(this.state.value);
    }
  }

  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  render() {
    const { title, message, type } = this.props;

    return (
      <Dialog
        ref="promptModal"
        closable={false}
        detachable={false}
        onDeny={() => {
          this.props.onCancelClick();
          return true;
        }}
        onApprove={() => {
          this.props.onOKClick(this.state.value);
          return true;
        }}
        open={this.state.modalOpen}
        onClose={this.handleClose}
        basic
        size="small"
      >
        {!!this.state.showDatabaseDiagram && <DialogTitle>{title}</DialogTitle>}
        <DialogContent>
          {message}
          <div className="ui fluid icon input">
            <input
              onChange={this.handleChange.bind(this)}
              type={type}
              onKeyPress={this.handleKeyPress.bind(this)}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <div
            className="small ui black deny right labeled icon button"
            tabIndex="0"
          >
            Cancel
            <i className="ban icon" />
          </div>
          <div
            className="small ui positive right labeled icon button"
            tabIndex="0"
          >
            OK
            <i className="checkmark icon" />
          </div>
        </DialogActions>
      </Dialog>
    );
  }
}
