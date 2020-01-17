<style>
.source code {
background: #eee;
}

.output code {
background: white;
font-style: italic;
color: black !important;
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

Jump to
* [Getting Started](#getting-started)

Author: Asuman Suenbuel, SAP Palo Alto

In the following, we will describe some common usage scenarios and
concept on how to use Rose through its command line interface
(cli). Rose is a framework for streamlining and scaling software
development projects by making use of meta-programming techniques that
are built into Rose. In a few words, the general idea is to be able to
create variations of software packages on source code level, without
the need to duplicate code and maintain different version of code
structures that overlap to a high percentage. In its current version,
Rose is developed in the context of robotics services, so you see
references to robots and backend systems that they should connect to
in the RoseStudio website and CLI, but the approach that Rose provides
is not limited to this domain.

<a id="getting-started">&nbsp;</a>

### Getting Started

Please follow the installation instructions given
[here](/doc/cli/index.html). We will first introduce some basic
concepts and usage pattern, so you are able to take full advantage of
the rose CLI.

First enter the following command:

```
$ rose server
```

This command is supposed to return the Rose server url, but you will probably see a message like this:

<pre class="source output"><code>You are not logged in into Rose. Please run "rose login".</code></pre>

Currently, rose uses Google OAuth2 login for authentication
users. More authentication methods are under development.  If you run
`rose login`, you will be re-directed to a browser window that
(depending on your current login-status in your browser) will either
present you with a dialog to login/select your account like that

![google-login](/images/doc/google-login.png)

After selecting your account, you will be forwarded to a website with the content:

![authentication page](/images/doc/auth-page.png)

You are now able to work with the rose CLI under your user id. If you now try the command again, you should get the expected result:

<pre class="source"><code>$ rose server
<i>https://rose-studio.cfapps.us10.hana.ondemand.com</i></code></pre>

Similarly, you can use `rose user` to display information about the account you are logged in with.

### Using help

Help content can be display as follows:

* for an overview of all commands and a brief description use "`rose help`"
* for help content for a specific rose command use "<code>rose _command_ --help</code>"
