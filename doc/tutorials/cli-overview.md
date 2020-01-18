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

co {
  filter: brightness(180%);
  font-style: italic;
}

red {
color: red;
}
</style>

Jump to
* [Getting Started](#getting-started)
* [Retrieving Information from Rose](#retrieving-information)

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
[here](/doc/cli/index.html).

Next, you should create a new working directory and "cd" into it, for instance:


<pre class="source"><code>$ mkdir <i>my-rose-dev</i> ; cd <i>my-rose-dev</i></code></pre>

To get started enter the following command, which is supposed to return the
Rose server url, but you will probably see a message like this:

<pre class="source"><code>$ rose server
<co>You are not logged in into Rose. Please run "rose login".</co></code></pre>

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
<co>https://rose-studio.cfapps.us10.hana.ondemand.com</co></code></pre>

Similarly, you can use `rose user` to display information about the account you are logged in with.

#### Using help

Help content can be display as follows:

* for an overview of all commands and a brief description use "`rose help`"
* for help content for a specific rose command use "<code>rose _command_ --help</code>"

<a id="retrieving-information">&nbsp;</a>

### Retrieving Information from Rose

The "`rose ls`" command can be used to retrieve information about the records stored in the Rose server. For instance, in order to list all robots stored in the system whose name matches a certain pattern, you can use:
<pre class="source"><code>$ rose ls robots Teal*
<co><red> NAME        UUID                                  MODIFIED_TIMESTAMP      </red>
 Teal One    614dd5e8-c84a-0e8b-b725-4acd1bd8a2a3  2019-12-26T06:35:45.314 
 Teal Sport  33bef552-2253-8ac0-1496-29d70326298a  2019-12-26T06:33:20.789 
</co></code></pre>

If you omit the name pattern you get the list of all records from that
entity (here "robots"). You can list backend system and connection
records in the same way.

Connections play a special role in Rose as they are the main artifacts
for defining connection scenarios. That's why we use the terms
"connection" and "scenario" through the Rose documentation
interchangably. However, for the "ls" command there is a slight
difference:

* "`rose ls connections ...`" returns (matching) records from _all_ connection objects; i.e. classes and instances alike; 
* "`rose ls scenarios ...`" only returns (matching) records from connection/scenario _classes_.

We will cover the difference between classes and instance in the Rose context in more detail later using an example.

You can also use the form "<code>rose ls instances
<i>name-pattern</i></code>" to list all the instances of a scenario
class. The name pattern has to resolve to exactly one scenario class.

<pre class="source"><code>$ rose ls instances "Gazebo Demo"
<co><red> NAME        UUID                                  MODIFIED_TIMESTAMP      </red>
 Instances of scenario class "Gazebo Demo":
 NAME                     UUID                                  MODIFIED_TIMESTAMP      
 Customer A Instance      4baa8fc7-ec3a-85af-5115-985381bfedec  2019-12-30T04:05:55.419 
 Customer B Instance      7780c188-bcb1-86e9-3589-a5f59e4f8142  2019-12-30T04:06:12.602
 ...
</co></code></pre>