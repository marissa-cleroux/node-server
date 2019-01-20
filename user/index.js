let User = function() {
    this.data = {
        firstName: 'Unknown',
        lastName: 'Unknown',
        username: 'Unknown',
        emailAddress: 'Unknown',
        phoneNum: 'Unknown'
    };

    this.setFirstName = function(fName){
        this.data.firstName = fName;
    };

    this.getFirstName = function(){
        return this.data.firstName;
    };

    this.setLastName = function(lName) {
        this.data.lastName = lName;
    };

    this.getLastName = function(){
        return this.data.lastName;
    };

    this.setUsername = function(uName) {
        this.data.username = uName;
    };

    this.getUsername = function(){
        return this.data.username;
    };

    this.setEmailAddress = function(email) {
        this.data.emailAddress = email;
    };

    this.getEmailAddress = function(){
        return this.data.emailAddress;
    };

    this.setPhoneNum = function(pNum) {
        this.data.phoneNumber = pNum;
    };

    this.getPhoneNum = function(){
        return this.data.phoneNumber;
    };

    this.fill = function(info){
        for(let prop in this.data){
            if(info[prop] !== ""){
                this.data[prop] = info[prop];
            }
        }
    };

    this.getAllProperties = function(){
        return Object.values(this.data);
    }
};


exports.getInformation = function(info){
    let user = new User();
    user.fill(info);

    return user;
};

