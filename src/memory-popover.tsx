// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import RaisedButton from 'material-ui/RaisedButton';
import Popover from 'material-ui/Popover';
import Menu from 'material-ui/Menu';
import MenuItem from 'material-ui/MenuItem';
import DeveloperBoard from 'material-ui/svg-icons/hardware/developer-board';

export interface MemoryPopoverProps {
}

export interface MemoryPopoverState {
  open: boolean;
  anchorElement?: EventTarget;
}

export class MemoryPopover extends React.Component<MemoryPopoverProps, MemoryPopoverState> {

  constructor(props: MemoryPopoverProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  handleTouchTap = (event: Event) => {
    event.preventDefault();

    this.setState({
      open: true,
      anchorElement: event.currentTarget
    });
  }

  handleRequestClose = () => {
    this.setState({
      open: false
    });
  }

  render() {
    const { open, anchorElement } = this.state;

    const memoryUsageInMB = open ?
      `${Math.round(process.getProcessMemoryInfo().privateBytes / 1024)} MB` : null;
    const nodeCount = open ? `DOM Nodes: ${document.querySelectorAll('*').length}` : 0;

    const popoverStyle = {
      position: 'absolute',
      right: '0px',
      bottom: '0px'
    };

    return (
      <div style={popoverStyle}>
        <RaisedButton
          onTouchTap={this.handleTouchTap}
          icon={<DeveloperBoard />}
          label='Memory Usage'
        />
        <Popover
          open={open}
          anchorEl={anchorElement}
          anchorOrigin={{horizontal: 'middle', vertical: 'bottom'}}
          targetOrigin={{horizontal: 'middle', vertical: 'top'}}
          onRequestClose={this.handleRequestClose}
        >
          <Menu>
            <MenuItem primaryText={memoryUsageInMB} disabled />
            <MenuItem primaryText={nodeCount} disabled />
          </Menu>
        </Popover>
      </div>
    );
  }
}