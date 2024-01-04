class Action {
  label
  rolls
  frames
  isCSS
  priority

  constructor(label, rolls, frames, isCSS, priority) {
    this.label = label;
    this.rolls = rolls;
    this.frames = frames;
    this.isCSS = isCSS;
    this.priority = priority;
  }

  getValue() {
    return Math.trunc((this.frames / this.rolls) * 1000)
  }
}

// TODO: tweak these, tag and character should probably be less frames realistically
// A lot of the jump ones are rough estimates
const MANIP_ACTIONS = [
  new Action('Idle Animation', 1, 360, false, 0),
  new Action('Random Tag', 1, 15, true, 0),
  new Action('Random Character', 2, 15, true, 0),
  new Action('Shield', 9, 40, false, 0),
  new Action('Stage Load', 12, 400, true, 5),
  new Action('Standing Grab', 15, 35, false, 0),
  new Action('Up Tilt', 27, 39, false, 1),
  new Action('Upsmash', 40, 45, false, 2),
  new Action('Jump Airdodge Land', 62, 96, false, 0),
  new Action('Jump Land', 63, 86, false, 0),
  new Action('Jump Double-Jump Airdodge Land', 72, 165, false, 0),
  new Action('Jump Double-Jump Land', 73, 150, false, 0),
  new Action('Jump Fair Land', 88, 96, false, 0),
  new Action('Jump Double-Jump Fair Land', 98, 144, false, 0),
  new Action('Charged Upsmash', 400, 125, false, 3),
  new Action('Charged Downsmash', 430, 140, false, 3),
];
const SEAK_STAGE_LOAD = new Action('Seak Stage Load', 5, 400, true, 5);

const IN_GAME_THRESHOLD = 40;
const RANDOM_TAG_ACTION = MANIP_ACTIONS[1];
const RANDOM_CHAR_ACTION = MANIP_ACTIONS[2];
const STAGE_LOAD_ACTION = MANIP_ACTIONS[4];
const DP_MAX = 10000000000;
const PORT_ADVANCE_THRESHOLD = 5000; // Number of rolls when we switch to using the CSS ports

const findActionSequence = (total, actions) => {
  let dp = Array(total + 1).fill(DP_MAX);
  dp[0] = 0;

  for (let i = 1; i < total + 1; i++) {
    for (let j = 0; j < actions.length; j++) {
      let action = actions[j];
      // Does this action offer a more efficient way to achieve the current rolls?
      if (action.rolls <= i) {
        dp[i] = Math.min(dp[i - action.rolls] + action.getValue(), dp[i]);
      }
    }
  }

  // Now we Backtrack
  let actionSequence = new Map();
  let remainingValue = dp[total];
  let remainingRolls = total;

  while (remainingRolls > 0) {
    for (let i = actions.length - 1; i >= 0; i--) {
      let action = actions[i];

      if (action.rolls <= remainingRolls &&
        dp[remainingRolls - action.rolls] == (remainingValue - action.getValue())
      ) {
        if (actionSequence.get(action)) {
          actionSequence.set(action, actionSequence.get(action) + 1);
        } else {
          // first entry
          actionSequence.set(action, 1);
        }
        remainingRolls = remainingRolls - action.rolls
        remainingValue = remainingValue - action.getValue()
      }
    }
  }

  const sortedSequence = new Map([...actionSequence.entries()].sort((a, b) => b[0].priority - a[0].priority));

  return sortedSequence;
}

const buildActionSequence = (rolls) => {
  // TODO: filter actions based on mid-run manip setting
  // Maybe should do that in calling function?
  let actions = MANIP_ACTIONS;
  let actionSequence = new Map();
  const stageLoadAction = STAGE_LOAD_ACTION;

  if (rolls > IN_GAME_THRESHOLD) {
    actionSequence = findActionSequence(rolls - stageLoadAction.rolls, actions);
    // Add in the extra stage load manually
    if (actionSequence.get(stageLoadAction)) {
      actionSequence.set(stageLoadAction, actionSequence.get(stageLoadAction) + 1);
    } else {
      actionSequence.set(stageLoadAction, 1);
    }
  } else {
    // Create custom thing for CSS only
    if (rolls >= 2) {
      actionSequence.set(RANDOM_CHAR_ACTION, Math.floor(rolls / 2));
    }
    if (rolls % 2) {
      actionSequence.set(RANDOM_TAG_ACTION, rolls % 2);
    }
  }

  return actionSequence;
}

function addActionLine(parent, text) {
  let p = document.createElement('p');
  p.classList.add('action-line')
  p.innerHTML = text;

  parent.appendChild(p)
}


function printAction(parent, action, count) {
  addActionLine(parent, `${count} \u00D7 ${action.label} (${action.rolls})`);
}


function displayActionSequence(actionSequence, rolls) {
  let actionsBlock = document.getElementById('actions');

  let numActions = 0;
  for (let value of actionSequence.values()) {
    numActions += value;
  }

  // Print header
  addActionLine(actionsBlock, '----------------------------------');
  addActionLine(actionsBlock, `Achievable in ${numActions} action${numActions == 1 ? '' : 's'}`);
  addActionLine(actionsBlock, '----------------------------------');
  addActionLine(actionsBlock, `Manip Stage: [${'PEACH'}]`);
  addActionLine(actionsBlock, `Target: ${rolls} rolls`);

  actionsBlock.appendChild(document.createElement('br'));


  // Always attempt to print the stage loads first if applicable
  if (actionSequence.get(STAGE_LOAD_ACTION)) {
    let key = STAGE_LOAD_ACTION;
    let value = actionSequence.get(STAGE_LOAD_ACTION);
    printAction(actionsBlock, key, value);
  }

  for (let [key, value] of actionSequence.entries()) {
    if (key == STAGE_LOAD_ACTION) continue;
    printAction(actionsBlock, key, value);
  }
}


function displayPortAdvance(rolls) {
  let actionsBlock = document.getElementById('actions');

  let seconds = rolls / 4833.9;
  if (seconds > 0.25) {
    seconds -= 0.25;
  }
  let minutes = Math.floor(seconds / 60);
  // Update seconds to account for possible minutes
  seconds = seconds % 60;

  let minutesString = `${minutes} minute${minutes >= 2 ? 's' : ''}`;
  let secondsString = `${(seconds - 0.25).toFixed(2)} second${(seconds - 0.25) >= 2 ? 's' : ''}`;
  let duration = `${minutes ? minutesString + ' and ' : ''}${secondsString}`;

  addActionLine(actionsBlock, `Roll count exceeds ${PORT_ADVANCE_THRESHOLD}!`);
  addActionLine(actionsBlock, 'Start manip on the VS CSS');
  addActionLine(actionsBlock, '--------------------------------');
  addActionLine(actionsBlock, `Open two character ports for ${duration} and continue search!`);
}

function clearResults() {
  // Clear results display
  document.getElementById('summary').innerHTML = '';
  document.getElementById('actions').innerHTML = '';
}

function getActionSequence() {
  clearResults()
  const rollInput = document.getElementById('num-rolls');
  const rolls = parseInt(rollInput.value)

  if (rolls > PORT_ADVANCE_THRESHOLD) {
    displayPortAdvance(rolls);
  } else {
    const actionSequence = buildActionSequence(rolls);

    displayActionSequence(actionSequence, rolls);
  }
}

function inputKeyDown(event) {
  console.log(event.key);
}