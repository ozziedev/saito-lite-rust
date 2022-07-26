//main
const StunMainContainer = require("./email-appspace.template");

// components
const StunComponentMyStun = require("../components/my-stun");

const VideoChat = require('../../../../lib/saito/ui/video-chat/video-chat');


class Container {
    constructor(app, mod) {
        this.app = app;
        this.mod = mod;
        this.selectedTab = "my-stun";
        this.videoChat = "";
        this.peer_connection = "";
        this.localStream = "";
        this.remoteStream = "";

        this.stun = {
            ip_address: "",
            port: "",
            offer_sdp: "",
            pc: "",
            listeners: [],
            iceCandidates: []
        };

        this.myStun = new StunComponentMyStun(app, mod);


        this.mapTabToTemplate = {
            "my-stun": this.myStun,
        };

        this.videoChat = new VideoChat(app, mod);
    }


    render(app = this.app, mod = this.mod) {
        if (!document.querySelector('.stun-container'))

            if (document.querySelector('#email-appspace')) {
                document.querySelector('#email-appspace').innerHTML = sanitize(StunMainContainer(app, mod));
            } else {
                app.browser.addElementToDom(sanitize(StunMainContainer(app, mod)));
            }


        // render the selected tab
        const Tab = this.mapTabToTemplate[this.selectedTab];
        Tab.render(app, mod);

        if (this.localStream && document.querySelector('#localStream')) {
            document.querySelector('#localStream').srcObject = this.localStream;
        }
        if (this.remoteStream && document.querySelector('#remoteStream1')) {
            document.querySelector('#remoteStream1').srcObject = this.remoteStream;
        }

        // this.attachEvents(app, mod);
    }




}



module.exports = Container;