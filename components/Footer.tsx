import Link from "next/link"

const Footer = () => {
  return (
    <footer className="px-6 md:px-16 lg:px-36 mt-40 w-full text-gray-300">
      <div className="flex flex-col md:flex-row justify-between w-full gap-10 border-b border-gray-500 pb-14">
          <div className="md:max-w-96">
              <Link href="/" className="max-xl:flex-1">
                <div className="text-3xl font-bold">
                    Quick<span className="text-red-800">Show</span>
                </div>
            </Link>
              <p className="mt-6 text-sm">
                  This website uses the TMDb API but is not endorsed or certified by TMDb. All movie, TV, and person data is provided by The Movie Database (TMDb).
              </p>
              <div className="flex items-center gap-2 mt-4">
                  <img src="https://raw.githubusercontent.com/prebuiltui/prebuiltui/refs/heads/main/assets/appDownload/googlePlayBtnBlack.svg" alt="google play" className="h-10 w-auto border border-white rounded" />
                  <img src="https://raw.githubusercontent.com/prebuiltui/prebuiltui/refs/heads/main/assets/appDownload/appleStoreBtnBlack.svg" alt="app store" className="h-10 w-auto border border-white rounded" />
              </div>
          </div>
          <div className="flex-1 flex items-start md:justify-end gap-20 md:gap-40">
              <div>
                  <h2 className="font-semibold mb-5">Company</h2>
                  <ul className="text-sm space-y-2">
                      <li><a href="#">Home</a></li>
                      <li><a href="#">About us</a></li>
                      <li><a href="#">Contact us</a></li>
                      <li><a href="#">Privacy policy</a></li>
                  </ul>
              </div>
              <div>
                  <h2 className="font-semibold mb-5">Get in touch</h2>
                  <div className="text-sm space-y-2">
                      <p>+1-234-567-890</p>
                      <p>contact@example.com</p>
                  </div>
              </div>
          </div>
      </div>
      <p className="pt-4 text-center text-sm pb-5">
          Copyright {new Date().getFullYear()} © <a href="https://holtzdigital.com">Holtz Digital</a>. All Right Reserved.
      </p>
    </footer>
  )
}

export default Footer