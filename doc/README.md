<style>
.source code {
background: #eee;
}
box {
border: solid black 1pt;
display: block;
padding: 5pt;
}

red {
color: red;
}
</style>

<hr/>

## Rose API for NodeJS

_Asuman Suenbuel, SAP Palo Alto_

This package provides the API client for RoseStudio, a
meta-programming environment focussing on Robotics applications.  The
RoseStudio website can be found at
[here](https://rose-studio.cfapps.us10.hana.ondemand.com).

The list of API methods can be found [here](global.html).

### Purpose of the API

The Rose API enables the use of Rose features outside the RoseStudio website interface. It allows the developers to

- integrate Rose into their NodeJs code on source code basis, and/or
- use the command line interface to apply Rose's code-generation functionality on local files.

Documentation for the Rose Command Line Interface can be found [here](../cli/index.html).

### API method overview

The following figure illustrates the different groups of methods that the Rose API provides:

![API method overview](/images/doc/api-methods-overview.png)


