import { useFormik } from "formik";
import Link from "next/link";
import Input from "../../components/form/Input";
import Title from "../../components/ui/Title";
import { loginSchema } from "../../schema/login";
import { getSession, signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import { useEffect, useState } from "react";
import axios from "axios";

const Login = () => {
  const { push } = useRouter();
  const { data: session } = useSession();
  const [currentUser, setCurrentUser] = useState();
  const [nfcEnabled, setNfcEnabled] = useState(false); // State to handle NFC enable status

  const onSubmit = async (values, actions) => {
    const { fullName, tableName } = values;
    let options = { redirect: false, fullName, tableName };
    try {
      const res = await signIn("credentials", options);
      console.log("Sign in response:", res); // Debug log
  
      if (res.error) {
        throw new Error(res.error);
      }
  
      actions.resetForm();
      toast.success("Login successful", {
        position: "bottom-left",
        theme: "colored",
      });
  
      if (res.ok) {
        // Fetch user data after successful login
        const userResponse = await axios.get('/api/auth/session');
        console.log("User session data:", userResponse.data); // Debug log
  
        if (userResponse.data.user && userResponse.data.user.id) {
          push("/profile/" + userResponse.data.user.id);
        } else {
          console.error("User ID not available in session data");
          toast.error("Login successful, but user data is incomplete");
        }
      } else {
        console.error("Login response not OK");
        toast.error("Login process completed, but encountered an issue");
      }
    } catch (err) {
      console.error("Login error:", err); // Debug log
      toast.error(err.message || "An error occurred during login");
    }
  };

  const formik = useFormik({
    initialValues: {
      fullName: "",
      tableName: "",
    },
    onSubmit,
    validationSchema: loginSchema,
  });

  useEffect(() => {
    const getUser = async () => {
      try {
        if (session?.user?.id) {
          const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`);
          setCurrentUser(res.data?.find((user) => user._id === session.user.id));
          if (session && currentUser) {
            push("/profile/" + currentUser._id);
          }
        }
      } catch (err) {
        console.log(err);
      }
    };
    getUser();
  }, [session, push, currentUser]);

  const startNfcScan = async () => {
    if ('NDEFReader' in window) {
      const nfcReader = new window.NDEFReader();

      try {
        await nfcReader.scan();
        nfcReader.onreading = (event) => {
          for (const record of event.message.records) {
            if (record.recordType === "text") {
              const textDecoder = new TextDecoder(record.encoding);
              const nfcData = textDecoder.decode(record.data);
              const tableNameMatch = nfcData.match(/TableName=(\d+)/);

              if (tableNameMatch) {
                formik.setFieldValue('tableName', tableNameMatch[1]);
              }
            }
          }
        };
        setNfcEnabled(true); // Set NFC enabled status to true
        toast.success("NFC scanning started. Please scan the NFC tag again.");
      } catch (error) {
        console.log('NFC scanning failed: ', error);
        toast.error("NFC scanning failed. Please try again.");
      }
    } else {
      toast.error("NFC not supported on this device.");
    }
  };

  const onLogout = async () => {
    try {
      await signOut({ redirect: false });
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tableName: formik.values.tableName }),
      });
      toast.success("Logout successfully", {
        position: "bottom-left",
        theme: "colored",
      });
      push("/auth/login");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const inputs = [
    {
      id: 1,
      name: "fullName",
      type: "text",
      placeholder: "Your Full Name",
      value: formik.values.fullName,
      errorMessage: formik.errors.fullName,
      touched: formik.touched.fullName,
    },
    {
      id: 2,
      name: "tableName",
      type: "text",
      placeholder: formik.values.tableName ? "" : "Vui lòng quét NFC trên bàn",
      value: formik.values.tableName,
      errorMessage: formik.errors.tableName,
      touched: formik.touched.tableName,
      disabled: false,
    },
  ];

  return (
    <div className="container mx-auto">
      <form
        className="flex flex-col items-center my-20 md:w-1/2 w-full mx-auto"
        onSubmit={formik.handleSubmit}
      >
        <Title addClass="text-[40px] mb-6">Login</Title>
        <div className="flex flex-col gap-y-3 w-full">
          {inputs.map((input) => (
            <Input
              key={input.id}
              {...input}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />
          ))}
        </div>
        <div className="flex flex-col w-full gap-y-3 mt-6">
          <button className="btn-primary" type="submit">
            LOGIN
          </button>
          <button
            className="btn-primary !bg-secondary"
            type="button"
            onClick={onLogout}
          >
            LOGOUT
          </button>
          <button
            className="btn-primary !bg-secondary"
            type="button"
            onClick={startNfcScan} // Attach NFC scan event to this button
          >
            Bật NFC Để Quét
          </button>
        </div>
      </form>
    </div>
  );
};

export async function getServerSideProps({ req }) {
  const session = await getSession({ req });

  if (session?.user?.id) {
    const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`);
    const user = res.data?.find((user) => user._id === session.user.id);
    if (user) {
      return {
        redirect: {
          destination: "/profile/" + user._id,
          permanent: false,
        },
      };
    }
  }

  return {
    props: {},
  };
}

export default Login;
