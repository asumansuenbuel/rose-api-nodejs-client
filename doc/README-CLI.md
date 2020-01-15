<style>
.source code {
background: #eee;
}
</style>

-----------------------
## Rose Command Line Interface (CLI)

_Asuman Suenbuel, SAP Palo Alto_

The Rose command line interface (CLI) provides access to the
RoseStudio functionality from the Unix terminal command line. It uses
the Rose API methods to access the resources and features from the
RoseStudio server. Documentation for the Rose API can be found [here](../api/index.html).

A detailed reference documentation for all rose cli commands is [here](global.html).

### Prerequisites

You need to have `node` and `npm` installed on your machine. Please visit
[nodejs.org](https://nodejs.org), in case they are not installed.

### Installation

#### Download and install

The Rose CLI can be installed from the command line using the following command:

```plain
npm install git+https://github.com/asumansuenbuel/rose-api-nodejs-client.git
```

_Note, `npm install` behaves differently depending on the directory
from within you are invoking it. If the current directory has been
previously been set up as a node development folder (using `npm init`)
then `npm install` install packages into the local `node_modules`
directory. Otherwise, the installed packages go into the
`node_modules` folder in your home directory. If you add the `-g` (for
global) option, you have to run the command with root privileges and
the packages are installed in a system-wide folder. In that case you
can skip the step of adding to the PATH variable._

#### Setup

In order to access the "`rose`" command from your command line, you have to add to your PATH variable as follows:

```plain
export PATH=$PATH:$(npm bin)
```

This adds the directory containing the rose executable to your PATH. In
order to "permanently" add this to your PATH, run the `npm bin`
command and add the path that is shown to your PATH variable in your
shell startup file (e.g. `.profile` or `.bashrc`). Note, do not use
the command above verbatim to your startup file, as the result of `npm
bin` can be different during initialization of the terminal.

In order to check whether it's working, try the following command:

```plain
rose version
```

which should output a version number in the format "X.Y.Z".