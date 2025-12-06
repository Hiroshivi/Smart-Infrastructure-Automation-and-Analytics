# Smart-Infrastructure-Automation-and-Analytics
A Smart home innovation project to set custom commands to Home devices like Amazon alexa and Google Dot etc..

Steps to Run this project 

Step 1: Open HiveMQ Test Client

Open new tab: http://www.hivemq.com/demos/websocket-client/
Click "Connect" button (it will show "Connected")
In the "Subscriptions" section:

Type: smarthome/commands
Click "Subscribe"



Step 2: Connect Your App

Go back to your Smart Home app
Change Broker URL to: ws://broker.hivemq.com:8000/mqtt
Click "🔌 Connect to Device"
You should see: 🟢 Connected

Step 3: Send a Test Message

In your app, select command: "Turn On Light"
Set brightness: 75
Click "📤 Send to Device"

Step 4: Check HiveMQ Tab

Go to the HiveMQ tab
You should see your message appear in the "Messages" section!
