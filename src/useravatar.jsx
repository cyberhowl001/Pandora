import React, {useState, useEffect} from "react";
import { supabase } from "../supabaseClient";
import Avatar from "react-avatar";
import "./style.css"

const AvatarComponent = () => {

    const [email, setEmail] = useState(null);
    const [emailName, setEmailName] = useState("");
  

    useEffect(() => {
        const getUserEmail = async () => {
            const { data: { user } } = await supabase.auth.getUser();
           if (user && user.email){
            setEmail(user.email);
            setEmailName(user.email.split('@')[0])
           }
        };
        getUserEmail();
    }, []);

    return (
        <div className=" w-full h-[30%]" >
            <div className="w-full h-full flex justify-center items-center">
                  {email && (
                <Avatar
                email={email}
                size="50"
                // size={50}
                round={true}
                className="avatar"
                />
            )}
            </div>

            {/* name */}
              <div className=" w-full h-[30%] flex justify-center items-center font-bold " >
{emailName} 
              </div>
        </div>
    );
};
export default AvatarComponent;