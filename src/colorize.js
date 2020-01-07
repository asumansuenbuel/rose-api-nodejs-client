
// colored text in console output:

const colors = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];

const inColor = (color) => {
  var ccode = -1;
  switch(color) {
    case 'black':
      ccode = 0;
      break;
    case 'red':
      ccode = 1;
      break;
    case 'green':
      ccode = 2;
      break;
    case 'yellow':
      ccode = 3;
      break;
    case 'blue':
      ccode = 4;
      break;
    case 'magenta':
      ccode = 5;
      break;
    case 'cyan':
      ccode = 6;
      break;
    case 'white':
      ccode = 7;
      break;
    default:
      return (msg) => { return msg; }
  }
  return (msg) => {
    return '[3' + ccode + ';1m' + msg + '[39;0m';
  }
};

colors.forEach(color => {
  const fname = `in${color}`;
  exports[fname] = inColor(color);
})
